import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { xlsxResponse } from "@/lib/export/xlsx";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";
import {
  buildCutReportWorkbook,
  type ReportRow,
} from "@/lib/export/cut-report-sheet";
import { CUTTING_ORDER_STATUS_LABELS } from "@/lib/constants/labels";
import { cutReportTotals, weekdayName } from "@/lib/export/cut-report";
import {
  cuttingOrderWhere,
  parseCuttingOrderFilters,
} from "@/lib/repositories/cutting-order-filters";

/**
 * El concentrado de corte: una fila POR ORDEN.
 *
 * Es el único reporte del sistema que no se abre por talla, y es a propósito.
 * Responde "cómo rindió la tela en este corte", y eso se mide contra el total
 * de la orden: los metros se tienden una sola vez para todas las tallas
 * juntas, así que repartirlos entre renglones exigiría inventar un criterio
 * que en la mesa no existe.
 *
 * Reemplaza la hoja que se llevaba a mano y sale con su mismo formato —el
 * orden de las columnas, los colores y el semáforo—, porque se compara contra
 * las hojas viejas y se manda por correo a quien no tiene la app enfrente.
 */
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

  const rows: ReportRow[] = orders.map((order) => {
    const ordered = sum(order.lines.map((line) => line.orderedQuantity));
    const cut = sum(order.lines.map((line) => line.cutQuantity));
    const metersDelivered = toNumber(order.metersDelivered);
    const metersSpread = toNumber(order.metersSpread);
    const smallRemnant = toNumber(order.smallRemnant);

    const totals = cutReportTotals({
      orderedQuantity: ordered,
      cutQuantity: cut,
      metersDelivered,
      metersSpread,
      smallRemnant,
    });

    /* El orden ES el de las columnas de la hoja. Va como arreglo y no como
       objeto porque la hoja es un formato fijo: son las mismas dieciocho
       casillas, siempre en el mismo lugar, y nombrarlas aquí invitaría a
       reordenarlas de un lado sin acordarse del otro. */
    return [
      order.orderedAt,
      weekdayName(order.orderedAt),
      /* El folio interno cuando no hay número del cliente: la columna nunca
         va vacía, porque es por la que se busca la fila en la hoja. */
      order.reference ?? order.code,
      order.clientPo,
      order.client?.name ?? "Fábrica",
      CUTTING_ORDER_STATUS_LABELS[order.status],
      fabricName(order),
      order.description,
      ordered,
      cut,
      totals.difference,
      totals.surplusRate,
      metersDelivered,
      metersSpread,
      smallRemnant,
      totals.realAverage,
      totals.remnantRate,
      totals.leftover,
    ];
  });

  return xlsxResponse(buildCutReportWorkbook(rows), "reporte-corte");
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
}): string | null {
  if (order.material) return `${order.material.code} · ${order.material.name}`;
  return order.cutFabricText;
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
