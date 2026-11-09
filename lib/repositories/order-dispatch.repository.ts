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

  async findVouchers(orderId: string): Promise<DispatchVoucherRow[]> {
    return this.db.inventoryDocument.findMany({
      where: { ...orderVoucherWhere(orderId), status: { not: "CANCELLED" } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: VOUCHER_SELECT,
    });
  }
}
