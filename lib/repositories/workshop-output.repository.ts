import type { Prisma, WorkshopOutput } from "@prisma/client";
import { BaseRepository, type PrismaDelegate } from "@/lib/core/base-repository";

/** Tope de la lista de salidas del tablero, por la misma razón que el de entregas. */
export const WORKSHOP_OUTPUT_LIMIT = 300;

/** Una pieza de saldo: cuántas de una talla de una orden. */
export interface PieceCount {
  orderId: string;
  sizeId: string;
  pieces: number;
}

const OUTPUT_SELECT = {
  id: true,
  code: true,
  type: true,
  date: true,
  parts: true,
  notes: true,
  cancelledAt: true,
  cancellationReason: true,
  createdAt: true,
  workshop: { select: { id: true, name: true } },
  destinationWorkshop: { select: { name: true } },
  product: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  order: {
    select: {
      id: true,
      code: true,
      reference: true,
      description: true,
      client: { select: { name: true } },
    },
  },
  lines: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      quantity: true,
      scrapQuantity: true,
      scrapReason: true,
      clientPo: true,
      size: { select: { id: true, code: true } },
    },
  },
} satisfies Prisma.WorkshopOutputSelect;

export type WorkshopOutputRow = Prisma.WorkshopOutputGetPayload<{ select: typeof OUTPUT_SELECT }>;

/** Lo que el formulario necesita de cada orden con saldo. */
const ORDER_INFO_SELECT = {
  id: true,
  code: true,
  reference: true,
  description: true,
  clientId: true,
  client: { select: { name: true } },
  /* El reparto por PO de cada talla, para prellenar la salida a Embarques. */
  lines: {
    orderBy: { position: "asc" },
    select: {
      sizeId: true,
      poSplits: { orderBy: { position: "asc" }, select: { clientPo: true, quantity: true } },
    },
  },
} satisfies Prisma.CuttingOrderSelect;

export type BalanceOrderInfo = Prisma.CuttingOrderGetPayload<{ select: typeof ORDER_INFO_SELECT }>;

/**
 * Lectura de las salidas de taller y de las tres fuentes de su saldo.
 *
 * El saldo NO se guarda: se calcula cada vez de lo recibido y lo sacado. Así
 * no hay una columna que se pueda desfasar de su historia; el precio es
 * sumar al leer, y un taller tiene decenas de entregas vivas, no miles.
 */
export class WorkshopOutputRepository extends BaseRepository<
  WorkshopOutput,
  Prisma.WorkshopOutputCreateInput,
  Prisma.WorkshopOutputUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.workshopOutput;
  }

  protected get entityName(): string {
    return "la salida de taller";
  }

  /**
   * Toma el candado del taller. Dos salidas simultáneas del mismo taller
   * leerían el mismo saldo y las dos pasarían; en fila, la segunda ya ve lo
   * que sacó la primera. Es la misma regla que el `FOR UPDATE` del rollo.
   */
  async lockWorkshop(workshopId: string): Promise<void> {
    await this.db.$queryRaw`SELECT id FROM workshops WHERE id = ${workshopId} FOR UPDATE`;
  }

  /**
   * Lo que el taller CONFIRMÓ que le llegó por envío, menos lo que la casa
   * registró que regresó o se perdió. Un envío o su vale cancelados no cuentan.
   */
  async receivedFromShipments(workshopId: string, orderId?: string): Promise<PieceCount[]> {
    const shipments = await this.db.garmentShipment.findMany({
      where: {
        workshopId,
        ...(orderId ? { orderId } : {}),
        receivedAt: { not: null },
        status: { not: "CANCELLED" },
        OR: [{ documentId: null }, { document: { status: { not: "CANCELLED" } } }],
      },
      select: {
        orderId: true,
        lines: {
          select: {
            sizeId: true,
            sentQuantity: true,
            bundles: true,
            returnedQuantity: true,
            scrapQuantity: true,
          },
        },
      },
    });

    return shipments.flatMap((shipment) =>
      shipment.lines.map((line) => ({
        orderId: shipment.orderId,
        sizeId: line.sizeId,
        pieces: line.sentQuantity * line.bundles - line.returnedQuantity - line.scrapQuantity,
      })),
    );
  }

  /**
   * Lo que el taller confirmó que le llegó por vale de salida. Sólo los
   * vales ligados a UNA orden: uno de pedido completo no dice de qué orden es
   * cada pieza, y el saldo se lleva por orden.
   */
  async receivedFromVouchers(workshopId: string, orderId?: string): Promise<PieceCount[]> {
    const vouchers = await this.db.inventoryDocument.findMany({
      where: {
        type: "ISSUE",
        workshopId,
        cuttingOrderId: orderId ?? { not: null },
        workshopReceivedAt: { not: null },
        status: { not: "CANCELLED" },
      },
      select: {
        cuttingOrderId: true,
        cutLines: { select: { sizeId: true, quantity: true, bundles: true } },
      },
    });

    return vouchers.flatMap((voucher) =>
      voucher.cutLines.map((line) => ({
        orderId: voucher.cuttingOrderId ?? "",
        sizeId: line.sizeId,
        pieces: line.quantity * line.bundles,
      })),
    );
  }

  /** Lo que el taller ya sacó: buenas y merma, de las salidas vigentes. */
  async alreadyOut(workshopId: string, orderId?: string): Promise<PieceCount[]> {
    const lines = await this.db.workshopOutputLine.findMany({
      where: {
        output: { workshopId, cancelledAt: null, ...(orderId ? { orderId } : {}) },
      },
      select: {
        sizeId: true,
        quantity: true,
        scrapQuantity: true,
        output: { select: { orderId: true } },
      },
    });

    return lines.map((line) => ({
      orderId: line.output.orderId,
      sizeId: line.sizeId,
      pieces: line.quantity + line.scrapQuantity,
    }));
  }

  async findOrdersInfo(ids: string[]): Promise<BalanceOrderInfo[]> {
    if (ids.length === 0) return [];
    return this.db.cuttingOrder.findMany({ where: { id: { in: ids } }, select: ORDER_INFO_SELECT });
  }

  async findSizes(ids: string[]): Promise<{ id: string; code: string; order: number }[]> {
    if (ids.length === 0) return [];
    return this.db.size.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true, order: true },
    });
  }

  /** Las salidas de un taller, la más reciente primero. */
  async findForWorkshop(workshopId: string): Promise<WorkshopOutputRow[]> {
    return this.db.workshopOutput.findMany({
      where: { workshopId },
      select: OUTPUT_SELECT,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: WORKSHOP_OUTPUT_LIMIT,
    });
  }

  /** Lo que los talleres sacaron de una orden: la cadena que lee la casa. */
  async findForOrder(orderId: string): Promise<WorkshopOutputRow[]> {
    return this.db.workshopOutput.findMany({
      where: { orderId },
      select: OUTPUT_SELECT,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  }

  /** Lo que OTROS talleres dicen haberle mandado a éste de una orden. */
  async findIncoming(destinationWorkshopId: string, orderId: string): Promise<WorkshopOutputRow[]> {
    return this.db.workshopOutput.findMany({
      where: { destinationWorkshopId, orderId, cancelledAt: null },
      select: OUTPUT_SELECT,
      orderBy: { date: "asc" },
    });
  }

  /** A dónde puede mandar un taller: los demás talleres vivos del catálogo. */
  async findDestinations(workshopId: string): Promise<{ id: string; name: string }[]> {
    return this.db.workshop.findMany({
      where: { id: { not: workshopId }, deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  async findRow(id: string): Promise<WorkshopOutputRow | null> {
    return this.db.workshopOutput.findUnique({ where: { id }, select: OUTPUT_SELECT });
  }
}
