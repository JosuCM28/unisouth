import type { PackingOrder } from "@prisma/client";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import type { PrismaExecutor } from "@/lib/prisma";
import type { PackingMoveInput, PackingOrderInput } from "@/lib/validations/packing.schema";
import { BaseService } from "./base.service";
import { FinishedGoodsService } from "./finished-goods.service";

type LockedOrder = Pick<PackingOrder, "id" | "code" | "status" | "clientId">;

/**
 * Pedidos de empaque y sus cajas.
 *
 * Meter o sacar de una caja SIEMPRE mueve el inventario de Embarques por
 * FinishedGoodsService, en la misma transacción que cambia la caja: así lo
 * que dice la caja y lo que dice el kárdex nunca pueden contar distinto.
 */
export class PackingService extends BaseService {
  async create(input: PackingOrderInput): Promise<PackingOrder> {
    return this.transaction(async (tx) => {
      const order = await tx.packingOrder.create({
        data: {
          code: await this.sequencesWith(tx).next("PACKING_ORDER", "EMB", 4),
          name: input.name,
          clientId: input.clientId ?? null,
          date: input.date ?? new Date(),
          notes: input.notes,
          createdById: this.context.userId ?? null,
        },
      });
      await this.auditWith(tx).record({
        entity: "PackingOrder", entityId: order.id, action: "CREATE",
        reference: order.code, newValue: order, sensitivity: "LOW",
      });
      return order;
    });
  }

  /**
   * Corrige nombre, fecha y nota. El cliente sólo cambia con las cajas
   * vacías: con prenda adentro, cambiarlo dejaría en el pedido piezas de otro
   * dueño.
   */
  async update(id: string, input: PackingOrderInput): Promise<PackingOrder> {
    return this.transaction(async (tx) => {
      const before = await this.lockOpen(tx, id);
      const clientId = input.clientId ?? null;
      if (clientId !== before.clientId && (await this.piecesIn(tx, id)) > 0) {
        throw new BusinessRuleError("Vacía las cajas antes de cambiar el cliente del pedido.", "clientId");
      }

      const order = await tx.packingOrder.update({
        where: { id },
        data: { name: input.name, clientId, date: input.date, notes: input.notes ?? null },
      });
      await this.auditWith(tx).record({
        entity: "PackingOrder", entityId: id, action: "UPDATE",
        reference: order.code, oldValue: before, newValue: order, sensitivity: "LOW",
      });
      return order;
    });
  }

  /** Sólo con las cajas vacías: un pedido con prenda adentro se cierra, no se borra. */
  async remove(id: string): Promise<void> {
    await this.transaction(async (tx) => {
      const order = await this.lockOpen(tx, id);
      if ((await this.piecesIn(tx, id)) > 0) {
        throw new BusinessRuleError("Vacía las cajas antes de borrar el pedido.");
      }
      await tx.packingOrder.delete({ where: { id } });
      await this.auditWith(tx).record({
        entity: "PackingOrder", entityId: id, action: "DELETE",
        reference: order.code, oldValue: order, sensitivity: "MEDIUM",
      });
    });
  }

  /**
   * Nueva caja con el siguiente número. El pedido se bloquea primero: dos
   * personas dándole "Nueva caja" a la vez sacarían el mismo número.
   */
  async addBox(orderId: string): Promise<{ number: number }> {
    return this.transaction(async (tx) => {
      await this.lockOpen(tx, orderId);
      const number = (await tx.packingBox.count({ where: { orderId } })) + 1;
      await tx.packingBox.create({ data: { orderId, number } });
      return { number };
    });
  }

  /** Quita una caja VACÍA y recorre las de atrás para que no quede hueco. */
  async removeBox(boxId: string): Promise<void> {
    await this.transaction(async (tx) => {
      const box = await this.requireBox(tx, boxId);
      await this.lockOpen(tx, box.orderId);
      if (box.lines.some((line) => line.quantity > 0)) {
        throw new BusinessRuleError(`La caja ${box.number} tiene prendas. Sácalas antes de quitarla.`);
      }

      await tx.packingBox.delete({ where: { id: boxId } });
      // Ascendente: la 3 pasa a 2 cuando la 2 ya está libre, sin chocar con
      // el número único del pedido.
      const later = await tx.packingBox.findMany({
        where: { orderId: box.orderId, number: { gt: box.number } },
        orderBy: { number: "asc" },
        select: { id: true, number: true },
      });
      for (const next of later) {
        await tx.packingBox.update({ where: { id: next.id }, data: { number: next.number - 1 } });
      }
    });
  }

  /** Mete piezas de un renglón del inventario a la caja. */
  async pack(input: PackingMoveInput): Promise<void> {
    await this.transaction(async (tx) => {
      const box = await this.requireBox(tx, input.boxId);
      const order = await this.lockOpen(tx, box.orderId);
      await this.assertSameOwner(tx, order, input.stockId);

      await new FinishedGoodsService(this.context).applyToStockWith(tx, input.stockId, {
        type: "PACKED", quantity: -input.quantity, packingBoxId: box.id,
      });
      await tx.packingBoxLine.upsert({
        where: { boxId_stockId: { boxId: box.id, stockId: input.stockId } },
        create: { boxId: box.id, stockId: input.stockId, quantity: input.quantity },
        update: { quantity: { increment: input.quantity } },
      });
    });
  }

  /** Saca piezas de la caja y las regresa al inventario. */
  async unpack(input: PackingMoveInput): Promise<void> {
    await this.transaction(async (tx) => {
      const box = await this.requireBox(tx, input.boxId);
      await this.lockOpen(tx, box.orderId);
      const line = box.lines.find((entry) => entry.stockId === input.stockId);
      if (!line || line.quantity < input.quantity) {
        throw new BusinessRuleError(`La caja ${box.number} sólo tiene ${line?.quantity ?? 0} de ese renglón.`, "quantity");
      }

      await new FinishedGoodsService(this.context).applyToStockWith(tx, input.stockId, {
        type: "UNPACKED", quantity: input.quantity, packingBoxId: box.id,
      });
      if (line.quantity === input.quantity) {
        await tx.packingBoxLine.delete({ where: { id: line.id } });
        return;
      }
      await tx.packingBoxLine.update({ where: { id: line.id }, data: { quantity: { decrement: input.quantity } } });
    });
  }

  /** Cerrado = embarcado: sus cajas ya no se mueven. */
  async close(id: string): Promise<void> {
    await this.transaction(async (tx) => {
      const order = await this.lockOpen(tx, id);
      if ((await this.piecesIn(tx, id)) === 0) {
        throw new BusinessRuleError("El pedido no tiene prendas en sus cajas.");
      }
      await tx.packingOrder.update({
        where: { id },
        data: { status: "CLOSED", closedAt: new Date(), closedById: this.context.userId ?? null },
      });
      await this.auditWith(tx).record({
        entity: "PackingOrder", entityId: id, action: "UPDATE",
        reference: order.code, newValue: { estado: "CERRADO" }, sensitivity: "MEDIUM",
      });
    });
  }

  /** Reabrir lo ya embarcado es lo que se vigila: pide motivo. */
  async reopen(id: string, reason: string): Promise<void> {
    await this.transaction(async (tx) => {
      const order = await this.lock(tx, id);
      if (order.status !== "CLOSED") throw new BusinessRuleError(`${order.code} ya está abierto.`);
      await tx.packingOrder.update({
        where: { id },
        data: { status: "OPEN", closedAt: null, closedById: null },
      });
      await this.auditWith(tx).record({
        entity: "PackingOrder", entityId: id, action: "UPDATE",
        reference: order.code, newValue: { estado: "ABIERTO" }, sensitivity: "HIGH", reason,
      });
    });
  }

  private async lock(tx: PrismaExecutor, id: string): Promise<LockedOrder> {
    await tx.$queryRaw`SELECT id FROM packing_orders WHERE id = ${id} FOR UPDATE`;
    const order = await tx.packingOrder.findUnique({
      where: { id },
      select: { id: true, code: true, status: true, clientId: true },
    });
    if (!order) throw new NotFoundError("el pedido de empaque", id);
    return order;
  }

  private async lockOpen(tx: PrismaExecutor, id: string): Promise<LockedOrder> {
    const order = await this.lock(tx, id);
    if (order.status === "CLOSED") {
      throw new BusinessRuleError(`${order.code} está cerrado. Reábrelo para moverlo.`);
    }
    return order;
  }

  private async requireBox(tx: PrismaExecutor, boxId: string) {
    const box = await tx.packingBox.findUnique({
      where: { id: boxId },
      select: { id: true, number: true, orderId: true, lines: { select: { id: true, stockId: true, quantity: true } } },
    });
    if (!box) throw new NotFoundError("la caja", boxId);
    return box;
  }

  /** Un pedido de un cliente sólo acepta prenda de ese dueño o sin dueño. */
  private async assertSameOwner(tx: PrismaExecutor, order: LockedOrder, stockId: string): Promise<void> {
    if (!order.clientId) return;
    const stock = await tx.finishedStock.findUnique({ where: { id: stockId }, select: { clientId: true } });
    if (!stock) throw new NotFoundError("el renglón de inventario terminado", stockId);
    if (stock.clientId && stock.clientId !== order.clientId) {
      throw new BusinessRuleError("Esa prenda es de otro cliente; no entra en este pedido.");
    }
  }

  private async piecesIn(tx: PrismaExecutor, orderId: string): Promise<number> {
    const total = await tx.packingBoxLine.aggregate({
      where: { box: { orderId } },
      _sum: { quantity: true },
    });
    return total._sum.quantity ?? 0;
  }
}
