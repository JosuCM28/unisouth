import type { GarmentFolder, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

/** Una carpeta de la lista, con lo que tiene dentro ya contado. */
export interface GarmentFolderCard extends GarmentFolder {
  client: { id: string; name: string } | null;
  garmentCount: number;
  /** La primera prenda con foto: es la portada de la carpeta. */
  coverPhotoId: string | null;
}

/**
 * Lectura del catálogo visual de prendas.
 *
 * La regla que ordena TODO este archivo: **los bytes de las fotos nunca se
 * seleccionan aquí**. Una lista trae `photoId` y nada más; los bytes los pide
 * el navegador uno por uno a /api/garment-photos/[id], que es lo que le deja
 * cachearlos y lo que evita que abrir una carpeta de cuarenta prendas baje
 * doce megabytes de golpe por la red de la bodega.
 */
export class GarmentFolderRepository extends BaseRepository<
  GarmentFolder,
  Prisma.GarmentFolderCreateInput,
  Prisma.GarmentFolderUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.garmentFolder;
  }

  protected get entityName(): string {
    return "la carpeta";
  }

  /** Las carpetas vivas, con su portada y cuántas prendas tienen. */
  async findAllWithCounts(search?: string): Promise<GarmentFolderCard[]> {
    const where: Prisma.GarmentFolderWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { client: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const folders = await this.db.garmentFolder.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { garments: { where: { deletedAt: null } } } },
        /* Sólo la PRIMERA prenda con foto, y sólo su id: es la portada de la
           tarjeta. Traer las prendas completas para escoger una sería bajar la
           carpeta entera para pintar un cuadrito. */
        garments: {
          where: { deletedAt: null, photoId: { not: null } },
          orderBy: { position: "asc" },
          take: 1,
          select: { photoId: true },
        },
      },
    });

    return folders.map((folder) => ({
      ...folder,
      garmentCount: folder._count.garments,
      coverPhotoId: folder.garments[0]?.photoId ?? null,
    }));
  }

  /** Una carpeta con sus prendas, para la pantalla de la carpeta. */
  async findWithGarments(id: string) {
    return this.db.garmentFolder.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: { select: { id: true, name: true } },
        garments: {
          where: { deletedAt: null },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            reference: true,
            notes: true,
            photoId: true,
            _count: { select: { placements: true } },
          },
        },
      },
    });
  }

  /** Para el selector de "mover a otra carpeta". */
  async findSelectable() {
    return this.db.garmentFolder.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        client: { select: { name: true } },
      },
    });
  }

  /** Cuántas prendas vivas cuelgan de la carpeta. El servicio lo usa al borrar. */
  async countGarments(folderId: string): Promise<number> {
    return this.db.garment.count({ where: { folderId, deletedAt: null } });
  }
}

/**
 * Lectura de una prenda y sus marcados.
 *
 * Va aparte de la carpeta y no como un método más porque son dos pantallas con
 * dos preguntas distintas —"qué prendas hay" y "dónde va cada bordado"—, y un
 * repositorio que contesta las dos acaba trayendo de más para una de ellas.
 */
export class GarmentRepository extends BaseRepository<
  Prisma.GarmentGetPayload<object>,
  Prisma.GarmentCreateInput,
  Prisma.GarmentUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.garment;
  }

  protected get entityName(): string {
    return "la prenda";
  }

  /** La ficha: la prenda, su carpeta y la lista de marcados en su orden. */
  async findWithPlacements(id: string) {
    return this.db.garment.findFirst({
      where: { id, deletedAt: null },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            client: { select: { name: true } },
          },
        },
        placements: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            notes: true,
            photoId: true,
          },
        },
      },
    });
  }

  /**
   * Lo que hay que saber de una foto para servirla, SIN los bytes.
   *
   * Existe para que la ruta que sirve la imagen pueda contestar un 304 sin
   * haber leído nunca el BYTEA: el navegador vuelve a pedir la misma foto cada
   * vez que se abre la carpeta, y cargarla de la base para acabar diciendo "no
   * ha cambiado" es el desperdicio que esta consulta evita.
   */
  async findPhotoMeta(photoId: string) {
    return this.db.garmentPhoto.findUnique({
      where: { id: photoId },
      select: { id: true, mimeType: true, byteSize: true, createdAt: true },
    });
  }

  /** Los bytes. El único punto de la app que los lee. */
  async findPhotoData(photoId: string) {
    return this.db.garmentPhoto.findUnique({
      where: { id: photoId },
      select: { data: true, mimeType: true },
    });
  }
}
