import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxWithNotice,
  xlsxResponse,
  type XlsxColumn,
} from "@/lib/export/xlsx";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";
import { CUTTING_ORDER_STATUS_LABELS } from "@/lib/constants/labels";
import {
  cutReportTotals,
  weekdayName,
  REMNANT_WARNING_RATE,
  type CutReportTotals,
} from "@/lib/export/cut-report";
import {
  cuttingOrderWhere,
  parseCuttingOrderFilters,
} from "@/lib/repositories/cutting-order-filters";
import type { CuttingOrderStatus } from "@prisma/client";

/**
 * El concentrado de corte: una fila POR ORDEN.
 *
 * Es el único reporte del sistema que no se abre por talla, y es a propósito.
 * Responde "cómo rindió la tela en este corte", y eso se mide contra el total
 * de la orden: los metros se tienden una sola vez para todas las tallas
 * juntas, así que repartirlos entre renglones exigiría inventar un criterio
 * que en la mesa no existe.
 *
 * Reemplaza la hoja de cálculo que se llevaba a mano, por eso conserva sus
 * columnas y hasta el color de la retacería.
 */
interface Row {
  orderedAt: Date;
  reference: string;
  clientPo: string;
  client: string;
  status: CuttingOrderStatus;
  fabric: string;
  description: string;
  ordered: number;
  cut: number;
  metersDelivered: number | null;
  metersSpread: number | null;
  smallRemnant: number | null;
  totals: CutReportTotals;
}

const COLUMNS: XlsxColumn<Row>[] = [
  { header: "FECHA DE CORTE", value: (r) => r.orderedAt, kind: "date", width: 14 },
  { header: "DIAS", value: (r) => weekdayName(r.orderedAt), width: 12 },
  { header: "NO. ORDEN", value: (r) => r.reference, width: 14 },
  { header: "PO DEL CLIENTE", value: (r) => r.clientPo, width: 16 },
  { header: "CLIENTE", value: (r) => r.client, width: 22 },
  { header: "STATUS", value: (r) => CUTTING_ORDER_STATUS_LABELS[r.status], width: 14 },
  { header: "TIPO DE TELA -COLOR", value: (r) => r.fabric, width: 26 },
  { header: "DESCRIPCION", value: (r) => r.description, width: 26 },
  { header: "CANTIDAD REQUERIDA", value: (r) => r.ordered, kind: "number", width: 13 },
  { header: "CANTIDAD CORTADA", value: (r) => r.cut, kind: "number", width: 13 },
  {
    header: "DIFRENCIA ( CANT REQ.- CANT",
    value: (r) => r.totals.difference,
    kind: "number",
    width: 13,
  },
  {
    header: "% excedente",
    value: (r) => r.totals.surplusRate,
    kind: "percent0",
    width: 12,
  },
  {
    header: "METROS ENTREGADOS",
    value: (r) => r.metersDelivered,
    kind: "number",
    width: 13,
  },
  {
    header: "METROS TENDIDOS",
    value: (r) => r.metersSpread,
    kind: "number",
    width: 13,
  },
  {
    header: "RETACERIA CHICA",
    value: (r) => r.smallRemnant,
    kind: "number",
    width: 13,
  },
  {
    header: "PROMEDIO REAL",
    value: (r) => r.totals.realAverage,
    kind: "decimal3",
    width: 13,
  },
  {
    header: "% RETACERIA",
    value: (r) => r.totals.remnantRate,
    kind: "percent",
    width: 13,
    /* El semáforo de la hoja de papel. Sin retacería medida no hay color: una
       celda verde diría que el corte salió bien cuando lo que pasa es que
       nadie lo ha medido. */
    flag: (r) => {
      const rate = r.totals.remnantRate;
      if (rate === null) return undefined;
      return rate > REMNANT_WARNING_RATE ? "warn" : "ok";
    },
  },
  {
    header: "SOBRANTE TELA",
    value: (r) => r.totals.leftover,
    kind: "number",
    width: 13,
  },
];

export async function GET(request: Request) {
  // Recorre la tabla completa: sin tope es un vector de denegación.
  await enforceRateLimit("export:cut-report", EXPORT_LIMIT);

  await requirePermission("orders:browse");

  const url = new URL(request.url);
  const filters = parseCuttingOrderFilters({
    q: url.searchParams.get("q") ?? undefined,
    client: url.searchParams.get("client") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    folder: url.searchParams.get("folder") ?? undefined,
    /* Aquí el rango corre sobre la EDICIÓN, no sobre el día del pedido. Este
       archivo se baja al cerrar la jornada para ver qué se trabajó hoy, y una
       orden de la semana pasada a la que hoy se le anotaron los metros es
       justo lo que se está buscando. */
    dateField: "updatedAt",
  });

  const orders = await prisma.cuttingOrder.findMany({
    where: cuttingOrderWhere(filters),
    /* De lo más viejo a lo más nuevo, al revés que la lista: esto se lee como
       una bitácora del día —de la primera mesa a la última— y no como una
       pantalla donde lo reciente va arriba. */
    orderBy: [{ orderedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    // Una fila por orden, así que el tope de filas es el tope de órdenes.
    take: EXPORT_ROW_LIMIT,
    include: {
      client: { select: { name: true } },
      material: { select: { code: true, name: true } },
      lines: { select: { orderedQuantity: true, cutQuantity: true } },
    },
  });

  const rows: Row[] = orders.map((order) => {
    const ordered = sum(order.lines.map((line) => line.orderedQuantity));
    const cut = sum(order.lines.map((line) => line.cutQuantity));
    const metersDelivered = toNumber(order.metersDelivered);
    const metersSpread = toNumber(order.metersSpread);
    const smallRemnant = toNumber(order.smallRemnant);

    return {
      orderedAt: order.orderedAt,
      /* El folio interno cuando no hay número del cliente: la columna nunca va
         vacía, porque es por la que se busca la fila en la hoja. */
      reference: order.reference ?? order.code,
      clientPo: order.clientPo ?? "",
      client: order.client?.name ?? "Fábrica",
      status: order.status,
      fabric: fabricName(order),
      description: order.description ?? "",
      ordered,
      cut,
      metersDelivered,
      metersSpread,
      smallRemnant,
      totals: cutReportTotals({
        orderedQuantity: ordered,
        cutQuantity: cut,
        metersDelivered,
        metersSpread,
        smallRemnant,
      }),
    };
  });

  return xlsxResponse(
    toXlsxWithNotice(rows, COLUMNS, "Reporte de corte"),
    "reporte-corte",
  );
}

/**
 * La tela: la del catálogo y, si no hay, la escrita a mano.
 *
 * El mismo orden que usa la lista de salidas. Una orden sin material pero con
 * la tela apuntada a mano es lo normal mientras el catálogo se pone al día, y
 * dejar la columna vacía volvería inservible la fila.
 */
function fabricName(order: {
  material: { code: string; name: string } | null;
  cutFabricText: string | null;
}): string {
  if (order.material) return `${order.material.code} · ${order.material.name}`;
  return order.cutFabricText ?? "";
}

/** Un Decimal de Prisma a número plano, o `null` si no se capturó. */
function toNumber(value: { toString(): string } | null): number | null {
  if (value === null) return null;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
