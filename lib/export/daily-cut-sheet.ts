import { addDays, formatLongDayKey, weekdayLong } from "@/lib/report-period";
import type {
  DailyCutDay,
  DailyCutReport,
} from "@/lib/reports/daily-cut-calculations";
import { CUT_SPREAD_STYLE as S, CUT_SPREAD_STYLES_XML } from "./cut-spread-styles";
import { columnName, escapeXml, toXlsxCustom } from "./xlsx";

/**
 * El Excel de "Lo cortado": el REPORTE DIARIO DE CORTE Y TENDIDO.
 *
 * Copia la hoja que ya se le manda al jefe —colores, anchos, filtro— para que
 * no tenga que aprender a leer otra. El sistema sólo llena lo que sabe: qué
 * empresas se cortaron ese día y cuántas piezas. Los tendidos por mesa no se
 * capturan en la app, así que salen vacíos para llenarse a mano, y los totales
 * son fórmulas para que se muevan solos en cuanto alguien escribe un tendido.
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
const WIDTHS = [17, 17, 25, 15, 14.4, 18.1, 13.3, 20, 13.9, 20, 19, 65];
const LAST_COLUMN = columnName(HEADERS.length);
const HEADER_ROW = 4;

/* Las columnas de tendido, de E a J, se llenan a mano: van en verde. */
const SPREAD_COLUMNS = ["E", "F", "G", "H", "I", "J"];
/* Las de piezas que se suman: Cortado y los tres tendidos. Las de
   "Cliente / Modelo" que van en medio son texto y no entran. */
const PIECE_COLUMNS = ["D", "E", "G", "I"];

/* Un domingo sin corte no es un día que se reporte: la hoja de papel va de
   lunes a sábado. Si sí se cortó, aparece igual que cualquier otro día. */
const SUNDAY = 0;

/** Días desde el 30-dic-1899, que es como Excel guarda una fecha. */
function excelDay(key: string): number {
  const [year = 1900, month = 1, day = 1] = key.split("-").map(Number);
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

const textCell = (ref: string, value: string, style: number): string =>
  value
    ? `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
    : `<c r="${ref}" s="${style}"/>`;

const numberCell = (ref: string, value: number, style: number): string =>
  value ? `<c r="${ref}" s="${style}"><v>${value}</v></c>` : `<c r="${ref}" s="${style}"/>`;

const formulaCell = (ref: string, formula: string, value: number, style: number): string =>
  `<c r="${ref}" s="${style}"><f>${formula}</f><v>${value}</v></c>`;

const row = (index: number, cells: string[], height?: number): string =>
  height
    ? `<row r="${index}" ht="${height}" customHeight="1">${cells.join("")}</row>`
    : `<row r="${index}">${cells.join("")}</row>`;

/** Un renglón tapado por una fusión: todas sus celdas con el estilo del ancla. */
function bandRow(index: number, value: string, style: number, height?: number): string {
  const cells = HEADERS.map((_, column) =>
    textCell(`${columnName(column + 1)}${index}`, column === 0 ? value : "", style),
  );
  return row(index, cells, height);
}

/** Cada empresa una sola vez, en el orden en que se cortó. */
function clientsOf(day: DailyCutDay | undefined): string {
  if (!day) return "";
  return [...new Set(day.rows.map((item) => item.clientName).filter(Boolean))].join(", ");
}

function dayRow(index: number, key: string, day: DailyCutDay | undefined): string {
  const pieces = day?.pieces ?? 0;
  // SUM y no "+": un tendido que alguien llene con texto no tumba el total.
  const total = `SUM(${PIECE_COLUMNS.map((column) => `${column}${index}`).join(",")})`;
  return row(index, [
    textCell(`A${index}`, weekdayLong(key), S.text),
    `<c r="B${index}" s="${S.date}"><v>${excelDay(key)}</v></c>`,
    textCell(`C${index}`, clientsOf(day), S.text),
    numberCell(`D${index}`, pieces, S.cut),
    ...SPREAD_COLUMNS.map((column) => `<c r="${column}${index}" s="${S.spread}"/>`),
    formulaCell(`K${index}`, total, pieces, S.rowTotal),
    `<c r="L${index}" s="${S.notes}"/>`,
  ], 42);
}

function totalsRow(index: number, first: number, last: number, pieces: number): string {
  const sum = (column: string, value: number) =>
    formulaCell(`${column}${index}`, `SUM(${column}${first}:${column}${last})`, value, S.totalNumber);
  const blank = (column: string) => `<c r="${column}${index}" s="${S.totalNumber}"/>`;
  return row(index, [
    textCell(`A${index}`, "TOTALES DEL REPORTE", S.totalLabel),
    `<c r="B${index}" s="${S.totalLabel}"/>`,
    `<c r="C${index}" s="${S.totalLabel}"/>`,
    sum("D", pieces), sum("E", 0), blank("F"), sum("G", 0), blank("H"), sum("I", 0), blank("J"),
    sum("K", pieces),
    `<c r="L${index}" s="${S.border}"/>`,
  ]);
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

function sheetXml(rows: string[], lastDataRow: number, totalRow: number): string {
  const cols = WIDTHS.map(
    (width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
  ).join("");
  /* El orden de los elementos lo fija el esquema: Excel no abre el archivo
     si `autoFilter` va después de `mergeCells`. */
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${LAST_COLUMN}${totalRow}"/>
<sheetViews><sheetView showGridLines="0" tabSelected="1" workbookViewId="0"><pane ySplit="${HEADER_ROW}" topLeftCell="A${HEADER_ROW + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${rows.join("")}</sheetData>
<autoFilter ref="A${HEADER_ROW}:${LAST_COLUMN}${lastDataRow}"/>
<mergeCells count="3"><mergeCell ref="A1:${LAST_COLUMN}1"/><mergeCell ref="A2:${LAST_COLUMN}2"/><mergeCell ref="A${totalRow}:C${totalRow}"/></mergeCells>
<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

export function buildDailyCutWorkbook(report: DailyCutReport): Buffer {
  const byKey = new Map(report.days.map((day) => [day.key, day]));
  const keys = dayKeys(report);
  const first = HEADER_ROW + 1;
  const last = HEADER_ROW + keys.length;
  const spacer = last + 1;
  const totals = last + 2;

  const header = HEADERS.map((value, column) =>
    textCell(`${columnName(column + 1)}${HEADER_ROW}`, value, S.header),
  );
  const rows = [
    bandRow(1, "REPORTE DIARIO DE CORTE Y TENDIDO", S.title, 30),
    bandRow(2, subtitle(report), S.subtitle),
    row(HEADER_ROW, header, 38.1),
    ...keys.map((key, index) => dayRow(first + index, key, byKey.get(key))),
    bandRow(spacer, "", S.border),
    totalsRow(totals, first, last, report.totals.pieces),
  ];

  return toXlsxCustom(sheetXml(rows, last, totals), CUT_SPREAD_STYLES_XML, "Corte y tendido");
}
