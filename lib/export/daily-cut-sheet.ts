import {
  addDays,
  formatDayKey,
  formatLongDayKey,
  weekdayLong,
} from "@/lib/report-period";
import type {
  DailyCutDay,
  DailyCutReport,
} from "@/lib/reports/daily-cut-calculations";
import { toXlsxDocument, type SheetCell, type SheetRow } from "./xlsx";

/**
 * El Excel de "Lo cortado": el REPORTE DIARIO DE CORTE Y TENDIDO.
 *
 * Copia la forma de la hoja que ya se le manda al jefe para que no tenga que
 * aprender a leer otra. El sistema sólo llena lo que sabe —qué empresas se
 * cortaron ese día y cuántas piezas—; los tendidos por mesa no se capturan en
 * la app, así que sus columnas salen vacías para llenarse a mano, y el total
 * del renglón y los del reporte son fórmulas para que se muevan solos en
 * cuanto alguien escribe un tendido.
 */
const HEADERS = [
  "Día",
  "Fecha de actividad",
  "Cliente / Modelo",
  "Cortado (pzas)",
  "Tendido mesa 1 (pzas)",
  "Cliente / Modelo",
  "Tendido mesa 2 (pzas)",
  "Cliente / Modelo",
  "Tendido mesa 3 (pzas)",
  "Cliente / Modelo",
  "Total registrado (pzas)",
  "Observaciones",
];
const WIDTHS = [14, 17, 30, 14, 14, 20, 14, 20, 14, 20, 16, 40];
const WIDTH = HEADERS.length;
const HEADER_ROW = 4;

/* Las columnas de piezas que se suman: Cortado y los tres tendidos. Las de
   "Cliente / Modelo" que van en medio son texto y no entran. */
const PIECE_COLUMNS = ["D", "E", "G", "I"];
const TOTAL_COLUMN = "K";

/* Un domingo sin corte no es un día que se reporte: la hoja de papel va de
   lunes a sábado. Si sí se cortó, aparece igual que cualquier otro día. */
const SUNDAY = 0;

const text = (value: string): SheetCell => ({ value, style: "cell" });
const empty = (): SheetCell => ({ style: "cell" });
const number = (value: number | undefined): SheetCell => ({
  value: value || null,
  kind: "number",
  style: "cellNumber",
});

/** Cada empresa una sola vez, en el orden en que se cortó. */
function clientsOf(day: DailyCutDay | undefined): string {
  if (!day) return "";
  return [...new Set(day.rows.map((row) => row.clientName).filter(Boolean))].join(", ");
}

function dayRow(key: string, day: DailyCutDay | undefined, excelRow: number): SheetRow {
  const pieces = day?.pieces ?? 0;
  return [
    text(weekdayLong(key)),
    text(formatDayKey(key)),
    text(clientsOf(day)),
    number(pieces),
    empty(),
    empty(),
    empty(),
    empty(),
    empty(),
    empty(),
    {
      // SUM y no "+": un tendido que alguien llene con texto no tumba el total.
      formula: `SUM(${PIECE_COLUMNS.map((column) => `${column}${excelRow}`).join(",")})`,
      value: pieces,
      kind: "number",
      style: "gridTotalNumber",
    },
    empty(),
  ];
}

function totalRow(firstRow: number, lastRow: number, pieces: number): SheetRow {
  const sum = (column: string, value?: number): SheetCell => ({
    at: column.charCodeAt(0) - 64,
    formula: `SUM(${column}${firstRow}:${column}${lastRow})`,
    value: value ?? 0,
    kind: "number",
    style: "gridTotalNumber",
  });
  return [
    { at: 1, value: "TOTALES DEL REPORTE", style: "gridTotal", mergeTo: 3 },
    sum("D", pieces),
    sum("E"),
    sum("G"),
    sum("I"),
    sum(TOTAL_COLUMN, pieces),
  ];
}

/** Todos los días del rango, para que un día sin corte quede a llenar a mano. */
function dayKeys(report: DailyCutReport): string[] {
  const keys: string[] = [];
  const withCut = new Set(report.days.map((day) => day.key));
  for (let key = report.fromKey; key <= report.toKey; key = addDays(key, 1)) {
    const isSunday = new Date(`${key}T12:00:00Z`).getUTCDay() === SUNDAY;
    if (!isSunday || withCut.has(key)) keys.push(key);
  }
  return keys;
}

function subtitle(report: DailyCutReport): string {
  if (report.fromKey === report.toKey) {
    return `Reporte correspondiente al ${formatLongDayKey(report.fromKey)}`;
  }
  return `Reporte del ${formatLongDayKey(report.fromKey)} al ${formatLongDayKey(report.toKey)}`;
}

export function buildDailyCutWorkbook(report: DailyCutReport): Buffer {
  const byKey = new Map(report.days.map((day) => [day.key, day]));
  const keys = dayKeys(report);
  const firstRow = HEADER_ROW + 1;
  const lastRow = HEADER_ROW + keys.length;

  const rows: SheetRow[] = [
    [{ value: "REPORTE DIARIO DE CORTE Y TENDIDO", style: "title", mergeTo: WIDTH }],
    [{ value: subtitle(report), style: "label", mergeTo: WIDTH }],
    [],
    HEADERS.map((value) => ({ value, style: "gridHeader" })),
    ...keys.map((key, index) => dayRow(key, byKey.get(key), firstRow + index)),
    [],
    totalRow(firstRow, lastRow, report.totals.pieces),
  ];

  return toXlsxDocument(rows, WIDTHS, "Corte y tendido", { landscape: true, fitToWidth: true });
}
