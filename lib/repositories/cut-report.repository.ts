import type { CuttingOrder, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

/**
 * Sólo órdenes que de verdad son trabajo de esta mesa.
 *
 * Una cancelada no se entregó, y una de la otra planta sin agregar todavía no
 * es de la casa: contarlas inflaría justo la cifra que se lleva a dirección.
 */
const COUNTED_ORDERS = {
  status: { not: "CANCELLED" },
  addedAt: { not: null },
} satisfies Prisma.CuttingOrderWhereInput;

/**
 * Cortes con algo capturado en la ventana.
 *
 * Por las dos fechas: un corte abierto la semana pasada puede traer un bulto
 * capturado hoy, y un bulto sin fecha propia cuenta el día de su corte.
 */
function capturedBetween(from: Date, to: Date) {
  return {
    entries: { some: {} },
    OR: [
      { openedAt: { gte: from, lte: to } },
      { entries: { some: { capturedAt: { gte: from, lte: to } } } },
    ],
  } satisfies Prisma.CuttingBatchWhereInput;
}

const WORKED_ORDER_SELECT = {
  id: true,
  code: true,
  description: true,
  metersDelivered: true,
  metersSpread: true,
  smallRemnant: true,
  client: { select: { id: true, name: true } },
  lines: { select: { orderedQuantity: true } },
  /* TODOS los cortes de la orden, no sólo los de la ventana. Hacen falta para
     saber cuál fue el último y cuánto llevaba cortado la orden al cierre del
     periodo. Un corte vacío no cuenta: abrir la pantalla no es haber cortado. */
  batches: {
    where: { entries: { some: {} } },
    select: {
      id: true,
      openedAt: true,
      entries: {
        select: { quantity: true, bundles: true, capturedAt: true },
      },
    },
  },
} satisfies Prisma.CuttingOrderSelect;

const OPEN_ORDER_SELECT = {
  dueDate: true,
  lines: { select: { orderedQuantity: true, cutQuantity: true } },
} satisfies Prisma.CuttingOrderSelect;

const CAPTURED_CUT_SELECT = {
  id: true,
  number: true,
  label: true,
  openedAt: true,
  createdBy: { select: { name: true } },
  order: {
    select: {
      id: true,
      code: true,
      description: true,
      client: { select: { name: true } },
    },
  },
  entries: {
    select: {
      quantity: true,
      bundles: true,
      capturedAt: true,
      user: { select: { name: true } },
      line: {
        select: { position: true, size: { select: { code: true, order: true } } },
      },
    },
  },
} satisfies Prisma.CuttingBatchSelect;

export type CapturedCutRow = Prisma.CuttingBatchGetPayload<{
  select: typeof CAPTURED_CUT_SELECT;
}>;

export type WorkedOrderRow = Prisma.CuttingOrderGetPayload<{
  select: typeof WORKED_ORDER_SELECT;
}>;

export type OpenOrderRow = Prisma.CuttingOrderGetPayload<{
  select: typeof OPEN_ORDER_SELECT;
}>;

export class CutReportRepository extends BaseRepository<
  CuttingOrder,
  Prisma.CuttingOrderCreateInput,
  Prisma.CuttingOrderUpdateInput
> {
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.cuttingOrder;
  }

  protected get entityName(): string {
    return "la orden";
  }

  /**
   * Las órdenes con algún corte dentro de la ventana.
   *
   * Nunca por el `createdAt` de los renglones: guardar un corte borra y vuelve
   * a crear los renglones, así que corregir hoy un corte de la semana pasada
   * lo mudaría a hoy y la gráfica por día contaría ese trabajo en una fecha en
   * la que no se hizo.
   */
  async findWorkedOrders(from: Date, to: Date): Promise<WorkedOrderRow[]> {
    return this.db.cuttingOrder.findMany({
      where: {
        ...COUNTED_ORDERS,
        batches: { some: capturedBetween(from, to) },
      },
      select: WORKED_ORDER_SELECT,
    });
  }

  /**
   * Cada corte capturado en la ventana, con sus tallas.
   *
   * Mismo filtro y misma fecha que `findWorkedOrders`: las dos pestañas tienen
   * que dar el mismo total para el mismo periodo.
   */
  async findCapturedCuts(from: Date, to: Date): Promise<CapturedCutRow[]> {
    return this.db.cuttingBatch.findMany({
      where: { ...capturedBetween(from, to), order: COUNTED_ORDERS },
      select: CAPTURED_CUT_SELECT,
    });
  }

  /** Lo que sigue en la mesa ahora mismo, sin importar el periodo. */
  async findOpenOrders(): Promise<OpenOrderRow[]> {
    return this.db.cuttingOrder.findMany({
      where: {
        addedAt: { not: null },
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: OPEN_ORDER_SELECT,
    });
  }
}
