import type { GarmentShipment, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

const SHIPMENT_SELECT = {
  id: true,
  code: true,
  dispatchedAt: true,
  dispatchedBy: { select: { name: true } },
  stage: { select: { name: true } },
  workshop: { select: { name: true } },
  lines: { select: { sentQuantity: true, bundles: true } },
} satisfies Prisma.GarmentShipmentSelect;

const VOUCHER_SELECT = {
  id: true,
  code: true,
  status: true,
  receivedBy: true,
  dispatchedAt: true,
  dispatchedBy: { select: { name: true } },
  workshop: { select: { name: true } },
  cuttingBatch: { select: { number: true, label: true } },
  cutLines: { select: { quantity: true, bundles: true } },
} satisfies Prisma.InventoryDocumentSelect;

export type DispatchShipmentRow = Prisma.GarmentShipmentGetPayload<{
  select: typeof SHIPMENT_SELECT;
}>;

export type DispatchVoucherRow = Prisma.InventoryDocumentGetPayload<{
  select: typeof VOUCHER_SELECT;
}>;

/**
 * Las salidas de corte de una orden: las suyas y las de pedido completo que se
 * llevaron alguno de sus cortes, que no guardan una sola orden.
 */
export function orderVoucherWhere(
  orderId: string,
): Prisma.InventoryDocumentWhereInput {
  return {
    type: "ISSUE",
    cutLines: { some: {} },
    OR: [
      { cuttingOrderId: orderId },
      { sentBatches: { some: { orderId } } },
    ],
  };
}

export class OrderDispatchRepository extends BaseRepository<
  GarmentShipment,
  Prisma.GarmentShipmentCreateInput,
  Prisma.GarmentShipmentUpdateInput
> {
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.garmentShipment;
  }

  protected get entityName(): string {
    return "el envío";
  }

  async findShipments(orderId: string): Promise<DispatchShipmentRow[]> {
    return this.db.garmentShipment.findMany({
      where: {
        orderId,
        status: { not: "CANCELLED" },
        // Un envío cuyo vale ya se canceló tampoco va a salir.
        OR: [
          { documentId: null },
          { document: { status: { not: "CANCELLED" } } },
        ],
      },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      select: SHIPMENT_SELECT,
    });
  }

  /**
   * De estas órdenes, cuáles tienen algo LISTO para marcar como enviado.
   *
   * Es el mismo criterio que deja seleccionar un renglón en la ventana de
   * Enviar: si aquí se contara distinto, el botón aparecería para abrir una
   * ventana sin nada que marcar. Un vale en borrador no cuenta —la ventana lo
   * bloquea—; al aplicarse, el botón vuelve solo.
   *
   * Dos consultas para toda la página, no dos por orden.
   */
  async findOrderIdsWithPendingDispatch(
    orderIds: string[],
  ): Promise<Set<string>> {
    if (orderIds.length === 0) return new Set();

    const [shipments, vouchers] = await Promise.all([
      this.db.garmentShipment.findMany({
        where: {
          orderId: { in: orderIds },
          dispatchedAt: null,
          status: { not: "CANCELLED" },
          OR: [
            { documentId: null },
            { document: { status: { not: "CANCELLED" } } },
          ],
        },
        distinct: ["orderId"],
        select: { orderId: true },
      }),
      this.db.inventoryDocument.findMany({
        where: {
          type: "ISSUE",
          status: "APPLIED",
          dispatchedAt: null,
          cutLines: { some: {} },
          OR: [
            { cuttingOrderId: { in: orderIds } },
            { sentBatches: { some: { orderId: { in: orderIds } } } },
          ],
        },
        select: {
          cuttingOrderId: true,
          sentBatches: { select: { orderId: true } },
        },
      }),
    ]);

    const pending = new Set(shipments.map((row) => row.orderId));
    for (const voucher of vouchers) {
      if (voucher.cuttingOrderId) pending.add(voucher.cuttingOrderId);
      for (const batch of voucher.sentBatches) pending.add(batch.orderId);
    }

    // Un vale de pedido completo trae cortes de órdenes fuera de esta página.
    return new Set(orderIds.filter((id) => pending.has(id)));
  }

  async findVouchers(orderId: string): Promise<DispatchVoucherRow[]> {
    return this.db.inventoryDocument.findMany({
      where: { ...orderVoucherWhere(orderId), status: { not: "CANCELLED" } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: VOUCHER_SELECT,
    });
  }
}
