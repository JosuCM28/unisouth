import type { OrderFolder } from "@prisma/client";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import type { OrderFolderInput } from "@/lib/validations/order-folder.schema";
import { BaseService } from "./base.service";

/**
 * Carpetas de pedido: agrupan varias órdenes de corte de un mismo pedido.
 *
 * La carpeta NO guarda cantidades. Todo lo que muestra —piezas pedidas,
 * cortadas, cuánto falta— sale de sumar sus órdenes. Guardar un total propio
 * abriría la puerta a que la carpeta diga una cosa y los papeles otra, que es
 * exactamente el problema que se quiere resolver.
 */
export class OrderFolderService extends BaseService {
  async create(input: OrderFolderInput): Promise<OrderFolder> {
    return this.transaction(async (tx) => {
      const code = await this.sequencesWith(tx).next("ORDER_FOLDER", "PED", 4);

      const folder = await tx.orderFolder.create({
        data: {
          code,
          name: input.name,
          clientId: input.clientId,
          reference: input.reference,
          dueDate: input.dueDate,
          notes: input.notes,
          createdById: this.context.userId,
        },
      });

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: folder.id,
        action: "CREATE",
        reference: code,
        newValue: { code, name: input.name },
        sensitivity: "LOW",
      });

      return folder;
    });
  }

  async update(id: string, input: OrderFolderInput): Promise<OrderFolder> {
    return this.transaction(async (tx) => {
      const current = await tx.orderFolder.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("la carpeta", id);

      const folder = await tx.orderFolder.update({
        where: { id },
        data: {
          name: input.name,
          clientId: input.clientId,
          reference: input.reference,
          dueDate: input.dueDate,
          notes: input.notes,
        },
      });

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: id,
        action: "UPDATE",
        reference: current.code,
        oldValue: { name: current.name, clientId: current.clientId },
        newValue: { name: input.name, clientId: input.clientId },
        sensitivity: "LOW",
      });

      return folder;
    });
  }

  /**
   * Archiva el pedido para que deje de estorbar en la lista.
   *
   * Se exige que no queden órdenes con corte pendiente: archivar un pedido a
   * medias lo esconde del piso, y lo que no se ve no se corta. Si de verdad
   * ya no va, primero se cancelan sus órdenes.
   */
  async archive(id: string): Promise<OrderFolder> {
    return this.transaction(async (tx) => {
      const current = await tx.orderFolder.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("la carpeta", id);

      if (current.archivedAt) {
        throw new BusinessRuleError(`El pedido ${current.code} ya está archivado.`);
      }

      const pending = await tx.cuttingOrder.count({
        where: { folderId: id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      });

      if (pending > 0) {
        throw new BusinessRuleError(
          `El pedido ${current.code} todavía tiene ${pending} ${pending === 1 ? "orden abierta" : "órdenes abiertas"}. Termínalas o cancélalas antes de archivar.`,
        );
      }

      const folder = await tx.orderFolder.update({
        where: { id },
        data: { archivedAt: new Date() },
      });

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: id,
        action: "UPDATE",
        reference: current.code,
        oldValue: { archivado: false },
        newValue: { archivado: true },
        sensitivity: "LOW",
      });

      return folder;
    });
  }

  /** Lo saca del archivo: el cliente volvió a pedir sobre el mismo pedido. */
  async unarchive(id: string): Promise<OrderFolder> {
    return this.transaction(async (tx) => {
      const current = await tx.orderFolder.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("la carpeta", id);

      const folder = await tx.orderFolder.update({
        where: { id },
        data: { archivedAt: null },
      });

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: id,
        action: "UPDATE",
        reference: current.code,
        oldValue: { archivado: true },
        newValue: { archivado: false },
        sensitivity: "LOW",
      });

      return folder;
    });
  }

  /**
   * Mueve una orden a una carpeta, o la deja suelta con `folderId` nulo.
   *
   * Es la operación que permite ordenar lo que ya estaba capturado sin volver
   * a teclearlo: las órdenes de antes de que existieran las carpetas se
   * acomodan desde la lista, una por una.
   */
  async moveOrder(orderId: string, folderId?: string) {
    return this.transaction(async (tx) => {
      const order = await tx.cuttingOrder.findUnique({
        where: { id: orderId },
        include: { folder: { select: { code: true } } },
      });
      if (!order) throw new NotFoundError("la orden", orderId);

      let target: { code: string; name: string } | null = null;

      if (folderId) {
        const folder = await tx.orderFolder.findUnique({
          where: { id: folderId },
          select: { code: true, name: true, archivedAt: true },
        });
        if (!folder) throw new NotFoundError("la carpeta", folderId);

        /* Meter una orden viva en un pedido archivado la escondería de la
           lista diaria sin que nadie lo note. */
        if (folder.archivedAt) {
          throw new BusinessRuleError(
            `El pedido ${folder.code} está archivado. Sácalo del archivo antes de moverle órdenes.`,
          );
        }

        target = { code: folder.code, name: folder.name };
      }

      const updated = await tx.cuttingOrder.update({
        where: { id: orderId },
        data: { folderId: folderId ?? null },
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: orderId,
        action: "UPDATE",
        reference: order.code,
        oldValue: { pedido: order.folder?.code ?? null },
        newValue: { pedido: target?.code ?? null },
        sensitivity: "LOW",
      });

      return updated;
    });
  }

  /**
   * Borra la carpeta, y SÓLO si ya está vacía.
   *
   * Tirar la carpeta jamás puede tirar los papeles: por eso no se borra en
   * cascada. Pero dejar sueltas las órdenes de una carpeta borrada tampoco
   * sirve —se van al fondo de la lista general, sin el pedido que les daba
   * sentido, y ahí nadie las vuelve a encontrar—. Así que se exige vaciarla a
   * propósito: primero se borra o se mueve cada orden, y hasta entonces se va
   * la carpeta. Quien sólo quiere quitarla de en medio tiene Archivar.
   *
   * El `onDelete: SetNull` del esquema se queda como red: con esta regla ya no
   * llega a dispararse, pero si algún día se borra una carpeta por otro
   * camino, sus órdenes siguen sin irse con ella.
   */
  async remove(id: string): Promise<OrderFolder> {
    return this.transaction(async (tx) => {
      const current = await tx.orderFolder.findUnique({
        where: { id },
        include: { _count: { select: { orders: true } } },
      });
      if (!current) throw new NotFoundError("la carpeta", id);

      const orders = current._count.orders;

      if (orders > 0) {
        throw new BusinessRuleError(
          `El pedido ${current.code} todavía tiene ${orders} ${orders === 1 ? "orden" : "órdenes"}. Bórralas o muévelas a otro pedido antes de eliminarlo.`,
        );
      }

      const folder = await tx.orderFolder.delete({ where: { id } });

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: id,
        action: "DELETE",
        reference: current.code,
        oldValue: { name: current.name, ordenes: current._count.orders },
        sensitivity: "MEDIUM",
      });

      return folder;
    });
  }
}
