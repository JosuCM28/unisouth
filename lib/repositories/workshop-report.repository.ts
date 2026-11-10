import type { GarmentShipment, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";
import {
  shipmentScopeWhere,
  voucherScopeWhere,
  type WorkshopScope,
} from "./workshop-delivery.repository";

/*
 * Lo que el reporte del tablero lee de cada entrega.
 *
 * Enumerado campo por campo, igual que la ficha del taller: los comentarios
 * internos, los adjuntos y los demás envíos de la orden NO salen de la casa,
 * y una lista explícita hace que un campo nuevo no se cuele solo al Excel.
 */
const REPORT_LINE_SELECT = {
  sentQuantity: true,
  bundles: true,
  notes: true,
  size: { select: { code: true } },
  cutTag: { select: { name: true } },
} satisfies Prisma.GarmentShipmentLineSelect;

const SHIPMENT_REPORT_SELECT = {
  id: true,
  code: true,
  status: true,
  sentAt: true,
  parts: true,
  dispatchedAt: true,
  receivedAt: true,
  receivedNotes: true,
  receivedBy: { select: { name: true } },
  stage: { select: { name: true } },
  document: { select: { status: true } },
  order: {
    select: {
      code: true,
      reference: true,
      clientPo: true,
      description: true,
      cutFabricText: true,
      client: { select: { name: true } },
      material: { select: { name: true } },
    },
  },
  lines: { orderBy: { position: "asc" }, select: REPORT_LINE_SELECT },
} satisfies Prisma.GarmentShipmentSelect;

const VOUCHER_REPORT_SELECT = {
  id: true,
  code: true,
  status: true,
  date: true,
  concept: true,
  reference: true,
  clientPo: true,
  cutDescription: true,
  cutFabricText: true,
  dispatchedAt: true,
  workshopReceivedAt: true,
  workshopReceivedNotes: true,
  workshopReceivedBy: { select: { name: true } },
  client: { select: { name: true } },
  cutFabric: { select: { name: true } },
  cuttingBatch: { select: { number: true, label: true } },
  cuttingOrder: {
    select: { code: true, reference: true, clientPo: true, description: true },
  },
  cutLines: {
    orderBy: { order: "asc" },
    select: {
      quantity: true,
      bundles: true,
      notes: true,
      size: { select: { code: true } },
      cutTag: { select: { name: true } },
    },
  },
} satisfies Prisma.InventoryDocumentSelect;

export type ShipmentReportRow = Prisma.GarmentShipmentGetPayload<{
  select: typeof SHIPMENT_REPORT_SELECT;
}>;

export type VoucherReportRow = Prisma.InventoryDocumentGetPayload<{
  select: typeof VOUCHER_REPORT_SELECT;
}>;

export interface WorkshopReportRows {
  shipments: ShipmentReportRow[];
  vouchers: VoucherReportRow[];
}

/**
 * Las entregas de UN taller en un periodo, con su detalle por talla.
 *
 * Aparte de `WorkshopDeliveryRepository` porque aquella lee lo vivo de la
 * pantalla —con tope corto— y ésta un periodo completo para archivar. Usa los
 * MISMOS alcances: el reporte no puede traer algo que el tablero no enseña.
 */
export class WorkshopReportRepository extends BaseRepository<
  GarmentShipment,
  Prisma.GarmentShipmentCreateInput,
  Prisma.GarmentShipmentUpdateInput
> {
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.garmentShipment;
  }

  protected get entityName(): string {
    return "la entrega";
  }

  /** El periodo corre sobre la fecha de ENVÍO: qué se le mandó en ese lapso. */
  async findPeriod(
    scope: WorkshopScope,
    from: Date,
    to: Date,
  ): Promise<WorkshopReportRows> {
    const [shipments, vouchers] = await Promise.all([
      this.db.garmentShipment.findMany({
        where: { ...shipmentScopeWhere(scope), sentAt: { gte: from, lte: to } },
        orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
        take: EXPORT_ROW_LIMIT,
        select: SHIPMENT_REPORT_SELECT,
      }),
      this.db.inventoryDocument.findMany({
        where: { ...voucherScopeWhere(scope), date: { gte: from, lte: to } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        take: EXPORT_ROW_LIMIT,
        select: VOUCHER_REPORT_SELECT,
      }),
    ]);

    return { shipments, vouchers };
  }
}
