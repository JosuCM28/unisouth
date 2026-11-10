import {
  DELIVERY_KIND_LABELS,
  DELIVERY_PROGRESS_LABELS,
} from "@/lib/constants/labels";
import type { ReportPeriod } from "@/lib/report-period";
import type {
  NamedTotal,
  PeriodTotals,
  WorkshopBoardReport,
} from "@/lib/reports/workshop-board-report";
import type {
  ReportDelivery,
  ReportDeliveryLine,
} from "@/lib/reports/workshop-report-rows";
import { buildChartsSheet } from "./workshop-board-charts";
import {
  documentSheetXml,
  tableSheetXml,
  type CellKind,
  type SheetRow,
  type XlsxColumn,
} from "./xlsx";
import { toXlsxWorkbook } from "./xlsx-workbook";

export interface WorkshopBoardWorkbookInput {
  workshopName: string;
  period: ReportPeriod;
  /** Lo que estaba escrito en el buscador del tablero. */
  search: string;
  rows: ReportDelivery[];
  report: WorkshopBoardReport;
  /** Se llegó al tope de filas: el resumen lo dice en vez de callarlo. */
  truncated: boolean;
}

// ─── Resumen ──────────────────────────────────────────────────────────────

interface Indicator {
  label: string;
  value: (totals: PeriodTotals) => number | null;
  kind: CellKind;
}

/** Un decimal: "2.3 días" se lee; "2.3333" es ruido. */
function oneDecimal(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

const INDICATORS: Indicator[] = [
  { label: "Entregas", value: (t) => t.deliveries, kind: "number" },
  { label: "Piezas enviadas", value: (t) => t.pieces, kind: "number" },
  { label: "Bultos enviados", value: (t) => t.bundles, kind: "number" },
  { label: "Piezas recibidas", value: (t) => t.receivedPieces, kind: "number" },
  { label: "Piezas en camino", value: (t) => t.inTransitPieces, kind: "number" },
  { label: "Piezas aún en planta", value: (t) => t.inPlantPieces, kind: "number" },
  { label: "% de piezas recibidas", value: (t) => t.receivedShare, kind: "percent0" },
  {
    label: "Días promedio para confirmar",
    value: (t) => oneDecimal(t.avgDaysToReceive),
    kind: "number",
  },
  { label: "Días máximo para confirmar", value: (t) => t.maxDaysToReceive, kind: "number" },
  { label: "Entregas canceladas", value: (t) => t.cancelled, kind: "number" },
];

function change(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 1000) / 1000;
}

function headerRow(headers: string[], rightFrom: number): SheetRow {
  return headers.map((value, index) => ({
    value,
    style: index >= rightFrom ? "tableHeaderRight" : "tableHeader",
  }));
}

function indicatorRows(report: WorkshopBoardReport): SheetRow[] {
  return [
    [{ value: "Indicadores", style: "section", mergeTo: 7 }],
    headerRow(["Indicador", "Este periodo", "Periodo anterior", "Cambio"], 1),
    ...INDICATORS.map((indicator): SheetRow => {
      const current = indicator.value(report.totals);
      const previous = indicator.value(report.previous);
      return [
        { value: indicator.label },
        { value: current, kind: indicator.kind },
        { value: previous, kind: indicator.kind },
        { value: change(current, previous), kind: indicator.kind },
      ];
    }),
  ];
}

function pendingRows(report: WorkshopBoardReport): SheetRow[] {
  const title: SheetRow = [
    { value: "Por recibir: lo que más lleva esperando", style: "section", mergeTo: 7 },
  ];
  if (report.oldestPending.length === 0) {
    return [title, [{ value: "Nada pendiente: todo lo enviado en el periodo ya se confirmó." }]];
  }

  return [
    title,
    headerRow(["Folio", "Orden", "Cliente", "Prenda", "Piezas", "Días esperando", "En qué va"], 4),
    ...report.oldestPending.map((row): SheetRow => [
      { value: row.code },
      { value: row.orderReference },
      { value: row.clientName },
      { value: row.description },
      { value: row.pieces, kind: "number" },
      { value: row.daysWaiting, kind: "number" },
      { value: DELIVERY_PROGRESS_LABELS[row.progress], style: "right" },
    ]),
  ];
}

function stageRows(stages: NamedTotal[]): SheetRow[] {
  return [
    [{ value: "Por etapa", style: "section", mergeTo: 7 }],
    headerRow(["Etapa", "Entregas", "Piezas", "Recibidas", "% recibido"], 1),
    ...stages.map((stage): SheetRow => [
      { value: stage.name },
      { value: stage.deliveries, kind: "number" },
      { value: stage.pieces, kind: "number" },
      { value: stage.receivedPieces, kind: "number" },
      {
        value: stage.pieces > 0 ? stage.receivedPieces / stage.pieces : null,
        kind: "percent0",
      },
    ]),
  ];
}

function summarySheet(input: WorkshopBoardWorkbookInput): string {
  const { period, report } = input;
  const notice: SheetRow[] = input.truncated
    ? [[{ value: "⚠ Se alcanzó el tope de filas: acota el periodo para ver todo.", style: "label" }], []]
    : [];

  const rows: SheetRow[] = [
    [{ value: `Reporte de entregas · ${input.workshopName}`, style: "title", mergeTo: 7 }],
    [],
    [{ value: "Periodo", style: "label" }, { value: period.label }],
    [{ value: "Comparado con", style: "label" }, { value: period.previousLabel }],
    [
      { value: "Filtro", style: "label" },
      { value: input.search || "Sin filtro: todas las entregas del periodo" },
    ],
    [{ value: "Generado", style: "label" }, { value: new Date(), kind: "datetime" }],
    [
      { value: "Cómo se cuenta", style: "label" },
      {
        value:
          "Entra lo ENVIADO en el periodo, con su estado de hoy. Los días corren desde que salió de planta.",
      },
    ],
    [],
    ...notice,
    ...indicatorRows(report),
    [],
    ...pendingRows(report),
    [],
    ...stageRows(report.byStage),
  ];

  return documentSheetXml(rows, [32, 16, 18, 22, 12, 16, 16]);
}

// ─── Tablas de detalle ────────────────────────────────────────────────────

/* Una cancelada no trae datos (ver `workshop-report-rows`): sus celdas salen
   vacías y la fila dice sólo folio, fecha y que se canceló. */
const DELIVERY_COLUMNS: XlsxColumn<ReportDelivery>[] = [
  { header: "Folio", value: (r) => r.code, width: 16 },
  { header: "Tipo", value: (r) => DELIVERY_KIND_LABELS[r.kind], width: 16 },
  { header: "Estado", value: (r) => DELIVERY_PROGRESS_LABELS[r.progress], width: 14 },
  { header: "Orden", value: (r) => r.orderReference, width: 14 },
  { header: "PO cliente", value: (r) => r.clientPo, width: 14 },
  { header: "Cliente", value: (r) => r.clientName, width: 24 },
  { header: "Prenda", value: (r) => r.description, width: 30 },
  { header: "Tela", value: (r) => r.fabric, width: 24 },
  { header: "Etapa", value: (r) => r.stageName, width: 22 },
  { header: "Partes", value: (r) => r.parts, width: 16 },
  { header: "Enviada", value: (r) => r.sentAt, kind: "date", width: 12 },
  { header: "Salió de planta", value: (r) => r.dispatchedAt, kind: "datetime", width: 18 },
  { header: "Recibida", value: (r) => r.receivedAt, kind: "datetime", width: 18 },
  { header: "Recibió", value: (r) => r.receivedByName, width: 20 },
  { header: "Nota de recepción", value: (r) => r.receivedNotes, width: 30 },
  { header: "Bultos", value: (r) => r.bundles || null, kind: "number", width: 10 },
  { header: "Piezas", value: (r) => r.pieces || null, kind: "number", width: 10 },
  { header: "Días para confirmar", value: (r) => r.daysToReceive, kind: "number", width: 12 },
  { header: "Días esperando", value: (r) => r.daysWaiting, kind: "number", width: 12 },
];

interface SizeRow {
  delivery: ReportDelivery;
  line: ReportDeliveryLine;
}

const SIZE_COLUMNS: XlsxColumn<SizeRow>[] = [
  { header: "Folio", value: (r) => r.delivery.code, width: 16 },
  { header: "Estado", value: (r) => DELIVERY_PROGRESS_LABELS[r.delivery.progress], width: 14 },
  { header: "Orden", value: (r) => r.delivery.orderReference, width: 14 },
  { header: "Cliente", value: (r) => r.delivery.clientName, width: 24 },
  { header: "Prenda", value: (r) => r.delivery.description, width: 30 },
  { header: "Enviada", value: (r) => r.delivery.sentAt, kind: "date", width: 12 },
  { header: "Talla", value: (r) => r.line.sizeCode, width: 10 },
  { header: "Folio de corte", value: (r) => r.line.tagName, width: 14 },
  { header: "Bultos", value: (r) => r.line.bundles, kind: "number", width: 10 },
  { header: "Piezas por bulto", value: (r) => r.line.perBundle, kind: "number", width: 12 },
  { header: "Piezas", value: (r) => r.line.pieces, kind: "number", width: 10 },
  { header: "Anotación", value: (r) => r.line.notes, width: 30 },
];

/**
 * El libro completo: resumen, gráficas y el detalle en dos tablas con
 * autofiltro, para que quien lo recibe filtre por cliente o por estado sin
 * desarmar la portada.
 */
export function buildWorkshopBoardWorkbook(
  input: WorkshopBoardWorkbookInput,
): Buffer {
  const sizeRows = input.rows.flatMap((delivery) =>
    delivery.lines.map((line) => ({ delivery, line })),
  );

  return toXlsxWorkbook([
    { name: "Resumen", xml: summarySheet(input) },
    buildChartsSheet(input.report),
    { name: "Entregas", xml: tableSheetXml(input.rows, DELIVERY_COLUMNS) },
    { name: "Por talla", xml: tableSheetXml(sizeRows, SIZE_COLUMNS) },
  ]);
}
