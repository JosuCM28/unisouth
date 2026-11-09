import { REMNANT_LEVEL_LABELS } from "@/lib/constants/labels";
import { formatDayKey, formatWeekdayKey } from "@/lib/report-period";
import type { CutReportData } from "@/lib/reports/cut-report-calculations";
import {
  toXlsxDocument,
  type SheetCell,
  type SheetRow,
} from "./xlsx";

/**
 * El Excel del reporte de corte, en una sola hoja con forma de documento.
 *
 * Son bloques de formas distintas que se leen de corrido —resumen, días,
 * empresas, meses—, y se manda a quien no abre la app. Las cifras viajan como
 * número para que quien lo recibe pueda seguir sacando cuentas.
 */
const WIDTHS = [30, 14, 14, 14, 14, 14, 14];

export const number = (value: number | null): SheetCell => ({
  value,
  kind: "number",
});
export const percent = (value: number | null): SheetCell => ({
  value,
  kind: "percent",
});
export const text = (value: string): SheetCell => ({ value });

function section(title: string): SheetRow[] {
  return [[], [{ value: title, style: "section", mergeTo: WIDTHS.length }]];
}

export function header(labels: string[]): SheetRow {
  return labels.map((value, index) => ({
    value,
    style: index === 0 ? "tableHeader" : "tableHeaderRight",
  }));
}

function pair(label: string, value: SheetCell): SheetRow {
  return [{ value: label, style: "label" }, value];
}

function summaryRows({ summary, yieldData }: CutReportData): SheetRow[] {
  return [
    ...section("Resumen"),
    header(["Concepto", "Valor", "Vs. anterior"]),
    [text("Piezas cortadas"), number(summary.pieces), percent(summary.piecesChange)],
    [text("Órdenes trabajadas"), number(summary.orders), percent(summary.ordersChange)],
    [
      text("Metros tendidos"),
      number(yieldData.measuredOrders > 0 ? yieldData.metersSpread : null),
      percent(summary.metersChange),
    ],
    [
      text("Piezas por día trabajado"),
      number(summary.piecesPerDay),
      percent(summary.piecesPerDayChange),
    ],
    [text("Días con corte"), number(summary.workedDays)],
    [text("Cortes levantados"), number(summary.cuts)],
    [text("Pedido de esas órdenes"), number(summary.orderedPieces)],
    [text("Cortado de esas órdenes"), number(summary.cutPieces)],
    [text("% de lo pedido"), percent(summary.progress)],
  ];
}

function dailyRows({ daily }: CutReportData): SheetRow[] {
  return [
    ...section("Últimos 14 días"),
    header(["Día", "Piezas", "Diferencia"]),
    ...daily.days.map((day) => [
      text(formatWeekdayKey(day.key)),
      number(day.pieces),
      number(day.difference),
    ]),
    [
      { value: "Total", style: "total" },
      { value: daily.total, kind: "number", style: "totalNumber" },
    ],
    [text("14 días anteriores"), number(daily.previousTotal)],
    [text("Variación"), percent(daily.change)],
  ];
}

function clientRows({ clients }: CutReportData): SheetRow[] {
  return [
    ...section("Por empresa"),
    header(["Empresa", "Piezas", "% del total", "Órdenes", "Pedido", "Cortado", "Avance"]),
    ...clients.map((row) => [
      text(row.name),
      number(row.pieces),
      percent(row.share),
      number(row.orders),
      number(row.ordered),
      number(row.cut),
      percent(row.progress),
    ]),
  ];
}

function monthlyRows({ monthly }: CutReportData): SheetRow[] {
  return [
    ...section("Por mes"),
    header(["Mes", "Piezas", "Variación", "Metros"]),
    ...monthly.map((row) => [
      text(row.partial ? `${row.label} (incompleto)` : row.label),
      number(row.pieces),
      percent(row.change),
      number(row.meters || null),
    ]),
  ];
}

function yieldRows({ yieldData }: CutReportData): SheetRow[] {
  const level = yieldData.remnantLevel;
  // Sin órdenes medidas la celda va vacía: "no se midió" no es "salió cero".
  const measured = (value: number | null) =>
    number(yieldData.measuredOrders > 0 ? value : null);

  return [
    ...section("Rendimiento de tela"),
    pair("Órdenes con último corte", number(yieldData.closedOrders)),
    pair("De ésas, con metros", number(yieldData.measuredOrders)),
    pair("Metros entregados", measured(yieldData.metersDelivered)),
    pair("Metros tendidos", measured(yieldData.metersSpread)),
    pair("Sobrante de tela", number(yieldData.leftover)),
    pair("Retacería chica", measured(yieldData.smallRemnant)),
    pair("Metros por pieza", {
      value: yieldData.metersPerPiece,
      kind: "decimal3",
    }),
    pair("% de retacería", percent(yieldData.remnantRate)),
    pair("Semáforo", text(level ? REMNANT_LEVEL_LABELS[level] : "—")),
  ];
}

function topRows({ topOrders, topGarments }: CutReportData): SheetRow[] {
  return [
    ...section("Órdenes con más corte"),
    header(["Folio", "Piezas", "Empresa"]),
    ...topOrders.map((row) => [
      text(row.code),
      number(row.pieces),
      text(`${row.clientName} · ${row.description}`),
    ]),
    ...section("Prendas con más corte"),
    header(["Prenda", "Piezas", "Órdenes"]),
    ...topGarments.map((row) => [
      text(row.label),
      number(row.pieces),
      number(row.orders),
    ]),
  ];
}

function pendingRows({ pending }: CutReportData): SheetRow[] {
  return [
    ...section("Pendientes al día de hoy"),
    pair("Órdenes abiertas", number(pending.openOrders)),
    pair("Piezas por cortar", number(pending.pendingPieces)),
    pair("Órdenes vencidas", number(pending.overdueOrders)),
    pair("Piezas vencidas", number(pending.overduePieces)),
  ];
}

export function buildCutSummaryWorkbook(report: CutReportData): Buffer {
  const { period } = report;

  const rows: SheetRow[] = [
    [{ value: "REPORTE DE CORTE", style: "title" }],
    pair("Periodo", text(period.label)),
    pair("Desde", text(formatDayKey(period.fromKey))),
    pair("Hasta", text(formatDayKey(period.toKey))),
    pair("Comparado contra", text(period.previousLabel)),
    ...summaryRows(report),
    ...dailyRows(report),
    ...clientRows(report),
    ...monthlyRows(report),
    ...yieldRows(report),
    ...topRows(report),
    ...pendingRows(report),
  ];

  return toXlsxDocument(rows, WIDTHS, "Reporte de corte", {
    fitToWidth: true,
  });
}
