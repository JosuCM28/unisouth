import type { Garment, GarmentFolder, GarmentPlacement } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import {
  MAX_PHOTO_BYTES,
  type GarmentFolderInput,
  type GarmentInput,
  type GarmentUpdateInput,
  type PhotoInput,
  type PlacementInput,
  type PlacementUpdateInput,
} from "@/lib/validations/garment.schema";
import { BaseService } from "./base.service";

/** Lo que la pantalla manda sobre la foto: una nueva, quitarla, o no tocarla. */
type PhotoEdit = PhotoInput | "remove" | "keep";

/**
 * El catálogo visual de prendas.
 *
 * Contesta lo que ninguna otra pantalla contestaba: dónde va exactamente el
 * bordado en esta chamarra. Hasta hoy se resolvía prestándole al taller una
 * prenda de muestra, o con una foto en el celular de alguien; el día que esa
 * persona no estaba, el taller adivinaba y la prenda volvía mal marcada.
 *
 * No mueve inventario ni toca el kárdex: es documentación. Por eso las bajas
 * son lógicas y no hay folios de por medio.
 */
export class GarmentService extends BaseService {
  // ── Carpetas ─────────────────────────────────────────────────────────────

  async createFolder(input: GarmentFolderInput): Promise<GarmentFolder> {
    return this.transaction(async (tx) => {
      const folder = await tx.garmentFolder.create({
        data: {
          name: input.name,
          clientId: input.clientId,
          notes: input.notes,
          createdById: this.context.userId,
        },
      });

      await this.auditWith(tx).record({
        entity: "GarmentFolder",
        entityId: folder.id,
        action: "CREATE",
        reference: folder.name,
        newValue: { nombre: folder.name },
        sensitivity: "LOW",
      });

      return folder;
    });
  }

  async updateFolder(
    id: string,
    input: GarmentFolderInput,
  ): Promise<GarmentFolder> {
    return this.transaction(async (tx) => {
      const before = await this.requireFolder(tx, id);

      const folder = await tx.garmentFolder.update({
        where: { id },
        data: {
          name: input.name,
          clientId: input.clientId ?? null,
          notes: input.notes ?? null,
        },
      });

      await this.auditWith(tx).record({
        entity: "GarmentFolder",
        entityId: id,
        action: "UPDATE",
        reference: folder.name,
        oldValue: { nombre: before.name },
        newValue: { nombre: folder.name },
        sensitivity: "LOW",
      });

      return folder;
    });
  }

  /**
   * Baja lógica de la carpeta, sólo si está vacía.
   *
   * Vaciarla es un acto aparte, prenda por prenda: una carpeta con veinte
   * fichas fotografiadas se borra de un toque y quien lo hace no alcanza a ver
   * lo que se llevó por delante. Con las prendas fuera, la decisión ya se tomó
   * veinte veces.
   */
  async removeFolder(id: string, reason?: string): Promise<GarmentFolder> {
    return this.transaction(async (tx) => {
      const before = await this.requireFolder(tx, id);

      const garments = await tx.garment.count({
        where: { folderId: id, deletedAt: null },
      });

      if (garments > 0) {
        throw new BusinessRuleError(
          `${before.name} todavía tiene ${garments} ${
            garments === 1 ? "prenda" : "prendas"
          }. Quítalas antes de borrar la carpeta.`,
        );
      }

      const folder = await tx.garmentFolder.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await this.auditWith(tx).record({
        entity: "GarmentFolder",
        entityId: id,
        action: "DELETE",
        reference: before.name,
        oldValue: { nombre: before.name },
        sensitivity: "LOW",
        reason,
      });

      return folder;
    });
  }

  // ── Prendas ──────────────────────────────────────────────────────────────

  async createGarment(input: GarmentInput): Promise<Garment> {
    return this.transaction(async (tx) => {
      await this.requireFolder(tx, input.folderId);

      /* Al final de la carpeta: se agregan en el orden en que se van
         fotografiando, y colar la nueva al principio movería de sitio las que
         alguien ya aprendió a encontrar de un vistazo. */
      const last = await tx.garment.aggregate({
        where: { folderId: input.folderId },
        _max: { position: true },
      });

      const photoId = await this.savePhoto(tx, input.photo);

      const garment = await tx.garment.create({
        data: {
          folderId: input.folderId,
          name: input.name,
          reference: input.reference,
          notes: input.notes,
          photoId,
          position: (last._max.position ?? -1) + 1,
          createdById: this.context.userId,
        },
      });

      await this.auditWith(tx).record({
        entity: "Garment",
        entityId: garment.id,
        action: "CREATE",
        reference: garment.name,
        newValue: { nombre: garment.name, foto: Boolean(photoId) },
        sensitivity: "LOW",
      });

      return garment;
    });
  }

  async updateGarment(id: string, input: GarmentUpdateInput): Promise<Garment> {
    return this.transaction(async (tx) => {
      const before = await tx.garment.findFirst({
        where: { id, deletedAt: null },
      });
      if (!before) throw new NotFoundError("la prenda", id);

      const photoId = await this.replacePhoto(tx, before.photoId, input.photo);

      const garment = await tx.garment.update({
        where: { id },
        data: {
          name: input.name,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          photoId,
        },
      });

      await this.auditWith(tx).record({
        entity: "Garment",
        entityId: id,
        action: "UPDATE",
        reference: garment.name,
        oldValue: { nombre: before.name, foto: Boolean(before.photoId) },
        newValue: { nombre: garment.name, foto: Boolean(photoId) },
        sensitivity: "LOW",
      });

      return garment;
    });
  }

  /** A otra carpeta. La misma chamarra la piden dos clientes. */
  async moveGarment(id: string, folderId: string): Promise<Garment> {
    return this.transaction(async (tx) => {
      const before = await tx.garment.findFirst({
        where: { id, deletedAt: null },
        include: { folder: { select: { name: true } } },
      });
      if (!before) throw new NotFoundError("la prenda", id);

      const folder = await this.requireFolder(tx, folderId);

      const last = await tx.garment.aggregate({
        where: { folderId },
        _max: { position: true },
      });

      const garment = await tx.garment.update({
        where: { id },
        data: { folderId, position: (last._max.position ?? -1) + 1 },
      });

      await this.auditWith(tx).record({
        entity: "Garment",
        entityId: id,
        action: "UPDATE",
        reference: garment.name,
        oldValue: { carpeta: before.folder.name },
        newValue: { carpeta: folder.name },
        sensitivity: "LOW",
      });

      return garment;
    });
  }

  /**
   * Baja lógica de la prenda.
   *
   * Sus marcados y sus fotos NO se borran: la prenda se quita de la lista y lo
   * que documentaba sigue existiendo por si alguien la dio de baja de más. El
   * espacio que ocupan esas fotos es el precio de poder deshacer un dedazo.
   */
  async removeGarment(id: string, reason?: string): Promise<Garment> {
    return this.transaction(async (tx) => {
      const before = await tx.garment.findFirst({
        where: { id, deletedAt: null },
      });
      if (!before) throw new NotFoundError("la prenda", id);

      const garment = await tx.garment.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await this.auditWith(tx).record({
        entity: "Garment",
        entityId: id,
        action: "DELETE",
        reference: before.name,
        oldValue: { nombre: before.name },
        sensitivity: "LOW",
        reason,
      });

      return garment;
    });
  }

  // ── Marcados ─────────────────────────────────────────────────────────────

  async createPlacement(input: PlacementInput): Promise<GarmentPlacement> {
    return this.transaction(async (tx) => {
      const garment = await tx.garment.findFirst({
        where: { id: input.garmentId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!garment) throw new NotFoundError("la prenda", input.garmentId);

      const last = await tx.garmentPlacement.aggregate({
        where: { garmentId: input.garmentId },
        _max: { position: true },
      });

      const photoId = await this.savePhoto(tx, input.photo);

      const placement = await tx.garmentPlacement.create({
        data: {
          garmentId: input.garmentId,
          name: input.name,
          notes: input.notes,
          photoId,
          position: (last._max.position ?? -1) + 1,
        },
      });

      await this.auditWith(tx).record({
        entity: "Garment",
        entityId: garment.id,
        action: "UPDATE",
        reference: `${garment.name} · ${placement.name}`,
        newValue: { marcado: placement.name, foto: Boolean(photoId) },
        sensitivity: "LOW",
      });

      return placement;
    });
  }

  async updatePlacement(
    id: string,
    input: PlacementUpdateInput,
  ): Promise<GarmentPlacement> {
    return this.transaction(async (tx) => {
      const before = await tx.garmentPlacement.findUnique({
        where: { id },
        include: { garment: { select: { id: true, name: true } } },
      });
      if (!before) throw new NotFoundError("el marcado", id);

      const photoId = await this.replacePhoto(tx, before.photoId, input.photo);

      const placement = await tx.garmentPlacement.update({
        where: { id },
        data: {
          name: input.name,
          notes: input.notes ?? null,
          photoId,
        },
      });

      await this.auditWith(tx).record({
        entity: "Garment",
        entityId: before.garment.id,
        action: "UPDATE",
        reference: `${before.garment.name} · ${placement.name}`,
        oldValue: { marcado: before.name, foto: Boolean(before.photoId) },
        newValue: { marcado: placement.name, foto: Boolean(photoId) },
        sensitivity: "LOW",
      });

      return placement;
    });
  }

  /**
   * Borrado FÍSICO del marcado, al revés que la prenda.
   *
   * Un marcado es un renglón de una lista que se está armando —se escribe mal,
   * se corrige, se quita—, no una ficha con historia. Dejarlo dado de baja
   * obligaría a filtrar por `deletedAt` en la única pantalla que lo pinta, para
   * conservar un renglón que nadie va a volver a leer. Su foto se va con él.
   */
  async removePlacement(id: string): Promise<{ name: string }> {
    return this.transaction(async (tx) => {
      const before = await tx.garmentPlacement.findUnique({
        where: { id },
        include: { garment: { select: { id: true, name: true } } },
      });
      if (!before) throw new NotFoundError("el marcado", id);

      await tx.garmentPlacement.delete({ where: { id } });

      if (before.photoId) {
        await tx.garmentPhoto.delete({ where: { id: before.photoId } });
      }

      await this.auditWith(tx).record({
        entity: "Garment",
        entityId: before.garment.id,
        action: "UPDATE",
        reference: `${before.garment.name} · ${before.name}`,
        oldValue: { marcado: before.name },
        newValue: { marcado: null },
        sensitivity: "LOW",
      });

      return { name: before.name };
    });
  }

  /** Reordena los marcados de una prenda: el orden es en el que se bordan. */
  async reorderPlacements(garmentId: string, ids: string[]): Promise<number> {
    return this.transaction(async (tx) => {
      const current = await tx.garmentPlacement.findMany({
        where: { garmentId },
        select: { id: true },
      });

      const own = new Set(current.map((row) => row.id));

      /* Se exige la lista COMPLETA y de esta prenda. Una parcial dejaría a los
         que faltan con la posición vieja, mezclados a media lista con los
         nuevos, y el orden resultante no sería ni el de antes ni el pedido. */
      if (ids.length !== own.size || ids.some((id) => !own.has(id))) {
        throw new BusinessRuleError(
          "La lista de marcados cambió mientras la ordenabas. Vuelve a abrir la prenda.",
        );
      }

      for (const [position, id] of ids.entries()) {
        await tx.garmentPlacement.update({ where: { id }, data: { position } });
      }

      return ids.length;
    });
  }

  // ── Fotos ────────────────────────────────────────────────────────────────

  /**
   * Guarda una foto nueva y devuelve su id, o `undefined` si no venía ninguna.
   *
   * Los bytes se decodifican AQUÍ y no en la pantalla: el data URL es el
   * formato en que viaja, no en el que se guarda. Guardar el base64 tal cual
   * ocuparía un tercio más de disco y obligaría a decodificar en cada lectura.
   */
  private async savePhoto(
    tx: PrismaExecutor,
    photo: PhotoEdit,
  ): Promise<string | undefined> {
    if (photo === "keep" || photo === "remove") return undefined;

    const data = decodePhoto(photo);

    const row = await tx.garmentPhoto.create({
      data: {
        data,
        mimeType: photo.mimeType,
        width: photo.width,
        height: photo.height,
        byteSize: data.length,
        createdById: this.context.userId,
      },
      select: { id: true },
    });

    return row.id;
  }

  /**
   * Aplica el cambio de foto de algo que ya existe y devuelve el id que queda.
   *
   * La anterior se borra de verdad: es la única fila de toda la app que puede
   * pesar megabytes, y dejar acumuladas las versiones descartadas haría crecer
   * la base con fotos que ninguna pantalla vuelve a pedir. Va después de crear
   * la nueva y dentro de la misma transacción, así que un fallo a media
   * operación deja la foto vieja intacta.
   */
  private async replacePhoto(
    tx: PrismaExecutor,
    currentId: string | null,
    photo: PhotoEdit,
  ): Promise<string | null> {
    if (photo === "keep") return currentId;

    if (photo === "remove") {
      if (currentId) await tx.garmentPhoto.delete({ where: { id: currentId } });
      return null;
    }

    const nextId = await this.savePhoto(tx, photo);

    if (currentId) await tx.garmentPhoto.delete({ where: { id: currentId } });

    return nextId ?? null;
  }

  /** La carpeta, comprobando que siga viva. */
  private async requireFolder(tx: PrismaExecutor, id: string) {
    const folder = await tx.garmentFolder.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!folder) throw new NotFoundError("la carpeta", id);

    return folder;
  }
}

/**
 * Del data URL a los bytes.
 *
 * El tope se vuelve a comprobar sobre los bytes YA decodificados y no sobre el
 * texto que llegó: base64 abulta un tercio, así que medir la cadena rechazaría
 * fotos que sí caben. Zod ya validó la forma; esto valida el peso real.
 */
function decodePhoto(photo: PhotoInput): Uint8Array<ArrayBuffer> {
  const base64 = photo.dataUrl.slice(photo.dataUrl.indexOf(",") + 1);
  /* Se COPIA a un Uint8Array propio en vez de pasar el Buffer de Node: el
     campo Bytes de Prisma pide un Uint8Array respaldado por un ArrayBuffer, y
     el Buffer se apoya en un ArrayBufferLike que puede ser compartido. */
  const data = Uint8Array.from(Buffer.from(base64, "base64"));

  if (data.length === 0) {
    throw new BusinessRuleError("La foto llegó vacía. Vuelve a elegirla.");
  }

  if (data.length > MAX_PHOTO_BYTES) {
    throw new BusinessRuleError(
      `La foto pesa ${Math.round(data.length / 1024)} KB y el tope son ${
        MAX_PHOTO_BYTES / 1024
      } KB. Vuelve a tomarla.`,
    );
  }

  return data;
}
