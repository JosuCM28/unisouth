import { createZip } from "./zip";

/**
 * El .xlsx del concentrado de corte, con el formato de la hoja de la fábrica.
 *
 * Tiene generador propio y no usa `toXlsx` porque no es una tabla de datos:
 * es la REPRODUCCIÓN de un formato que ya existe, y del que la gente reconoce
 * los colores antes que las cifras —el encabezado cian, las columnas de
 * rendimiento en crema, el semáforo de la retacería—. Meter eso en el helper
 * genérico habría llenado de casos especiales una función que usan otras seis
 * exportaciones.
 *
 * Los colores, los anchos y los cortes del semáforo salen del archivo que
 * lleva la fábrica, no de una elección de diseño: el reporte se manda por
 * correo y se compara contra las hojas viejas, así que tiene que verse igual.
 */

/** Los colores del formato, tal como vienen en la hoja original. */
const CYAN = "FF4BACC6";
const CREAM = "FFFFFFCC";
const WHITE = "FFFFFFFF";
const GREEN = "FF00FF00";
const YELLOW = "FFFFFF00";
const RED = "FFFF0000";

/**
 * Los cortes del semáforo de la retacería, en tanto por uno.
 *
 * Verde hasta 2%, amarillo hasta 3% y rojo de ahí en adelante. Son los mismos
 * de la hoja de la fábrica: es el criterio con el que hoy se decide si un
 * tendido salió caro, y moverlo aquí lo cambiaría sin que nadie lo acordara.
 */
const REMNANT_YELLOW_FROM = 0.02;
const REMNANT_RED_FROM = 0.03;

/** Cómo se pinta y se formatea cada columna. */
type ColumnKind =
  /* Texto y número comparten tipo porque comparten formato: la hoja original
     deja ambos en General, y separarlos aquí sugeriría una diferencia de
     presentación que en el archivo no existe. */
  | "plain"
  | "date"
  | "percent0"
  | "percent2"
  | "average";

interface ReportColumn {
  header: string;
  width: number;
  kind: ColumnKind;
  /** Título en crema. Marca el bloque de rendimiento del encabezado. */
  cream?: boolean;
  /**
   * Además, las CELDAS en crema.
   *
   * Va aparte de `cream` porque en la hoja original no siempre coinciden:
   * SOBRANTE TELA lleva el título crema pero sus datos en blanco, y tratarlos
   * como una sola cosa teñiría una columna que allá es blanca.
   */
  creamBody?: boolean;
  /** La del semáforo: su fondo depende del valor de la fila. */
  trafficLight?: boolean;
}

/** Las dieciocho columnas, en el orden y con los anchos del formato. */
const COLUMNS: ReportColumn[] = [
  { header: "FECHA DE CORTE", width: 10.86, kind: "date" },
  { header: "DIAS", width: 12, kind: "plain" },
  { header: "NO. ORDEN", width: 14.86, kind: "plain" },
  { header: "PO DEL CLIENTE", width: 13.57, kind: "plain" },
  { header: "CLIENTE", width: 19.14, kind: "plain" },
  { header: "STATUS", width: 19.14, kind: "plain", cream: true, creamBody: true },
  { header: "TIPO DE TELA -COLOR", width: 24.57, kind: "plain" },
  { header: "DESCRIPCION", width: 27.43, kind: "plain" },
  { header: "CANTIDAD REQUERIDA", width: 12.57, kind: "plain" },
  { header: "CANTIDAD CORTADA", width: 10.71, kind: "plain" },
  { header: "DIFRENCIA ( CANT REQ.- CANT", width: 22.43, kind: "plain" },
  { header: "% excedente", width: 12, kind: "percent0" },
  { header: "METROS ENTREGADOS", width: 12, kind: "plain" },
  { header: "METROS TENDIDOS", width: 12, kind: "plain" },
  { header: "RETACERIA CHICA ", width: 12, kind: "plain" },
  {
    header: "PROMEDIO REAL",
    width: 10.57,
    kind: "average",
    cream: true,
    creamBody: true,
  },
  {
    header: "% RETACERIA",
    width: 16.57,
    kind: "percent2",
    cream: true,
    creamBody: true,
    trafficLight: true,
  },
  { header: "SOBRANTE TELA", width: 16.57, kind: "plain", cream: true },
];

/** Cuántas columnas lleva la hoja. Lo usa la ruta para armar cada fila. */
export const CUT_REPORT_COLUMN_COUNT = COLUMNS.length;

/** Una fila ya resuelta: dieciocho valores en el orden de las columnas. */
export type ReportCell = string | number | Date | null;
export type ReportRow = ReportCell[];

/* ── Índices del `cellXfs` de abajo ────────────────────────────────────────
   Se numeran a mano porque el orden del arreglo ES el contrato con Excel: un
   estilo insertado a la mitad recorre todos los de abajo y la hoja sale con
   los colores cambiados de lugar. */
const S_HEADER = 1;
const S_HEADER_CREAM = 2;
const S_TEXT = 3;
const S_TEXT_CREAM = 4;
const S_DATE = 5;
const S_PERCENT0 = 6;
const S_AVERAGE = 7;
const S_PERCENT2_GREEN = 8;
const S_PERCENT2_YELLOW = 9;
const S_PERCENT2_RED = 10;
const S_PERCENT2_PLAIN = 11;

function escapeXml(value: string): string {
  return (
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      /* Los caracteres de control rompen el XML y Excel se niega a abrir el
         archivo ENTERO: basta uno pegado en una descripción. */
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
  );
}

/** Referencia de columna: 1 → A, 27 → AA. */
function columnName(index: number): string {
  let name = "";
  let n = index;

  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }

  return name;
}

/**
 * Días desde 1900 con los que Excel representa una fecha.
 *
 * La base es el 30 de diciembre de 1899 porque Excel cree que el 29 de
 * febrero de 1900 existió, un error heredado de Lotus 1-2-3 que conserva por
 * compatibilidad. Sin reproducirlo, las fechas salen corridas un día.
 */
function excelSerialDate(date: Date): number {
  const epoch = Date.UTC(1899, 11, 30);
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

  return (utc - epoch) / 86_400_000;
}

/** El estilo del cuerpo para una columna, según su valor. */
function bodyStyle(column: ReportColumn, value: ReportCell): number {
  if (column.trafficLight) return trafficLightStyle(value);

  /* Las cantidades y los metros van en formato GENERAL, como en la hoja
     original: ahí un metraje se escribe tal como se midió —2.45, 37.2— y
     ponerle una máscara de miles lo alinearía distinto a la hoja con la que
     se compara. Los porcentajes y el promedio sí llevan el suyo, porque sin
     él saldrían como 0.0104 en vez de 1.04%. */
  const styles: Record<ColumnKind, number> = {
    plain: column.creamBody ? S_TEXT_CREAM : S_TEXT,
    date: S_DATE,
    percent0: S_PERCENT0,
    percent2: S_PERCENT2_PLAIN,
    average: S_AVERAGE,
  };

  return styles[column.kind];
}

/**
 * El color de la celda de retacería.
 *
 * Sin medir se queda en crema: una celda verde diría que el corte salió bien
 * cuando lo que pasa es que nadie lo ha medido todavía.
 */
function trafficLightStyle(value: ReportCell): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return S_PERCENT2_PLAIN;
  }
  if (value >= REMNANT_RED_FROM) return S_PERCENT2_RED;
  if (value >= REMNANT_YELLOW_FROM) return S_PERCENT2_YELLOW;
  return S_PERCENT2_GREEN;
}

function renderCell(
  reference: string,
  value: ReportCell,
  style: number,
): string {
  if (value === null || value === "") {
    // Con estilo aunque esté vacía: si no, se rompe la rejilla de bordes.
    return `<c r="${reference}" s="${style}"/>`;
  }

  if (value instanceof Date) {
    return `<c r="${reference}" s="${style}"><v>${excelSerialDate(value)}</v></c>`;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return `<c r="${reference}" s="${style}"/>`;
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  }

  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function buildSheet(rows: ReportRow[]): string {
  const cols = COLUMNS.map(
    (column, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
  ).join("");

  const headerCells = COLUMNS.map(
    (column, index) =>
      `<c r="${columnName(index + 1)}2" s="${column.cream ? S_HEADER_CREAM : S_HEADER}" t="inlineStr"><is><t>${escapeXml(column.header)}</t></is></c>`,
  ).join("");

  /* La fila 1 va oculta y los encabezados en la 2, igual que el formato de la
     fábrica: allá la primera fila es donde se pega el logotipo impreso. */
  const body = rows
    .map((row, rowIndex) => {
      const reference = rowIndex + 3;
      const cells = COLUMNS.map((column, index) =>
        renderCell(
          `${columnName(index + 1)}${reference}`,
          row[index] ?? null,
          bodyStyle(column, row[index] ?? null),
        ),
      ).join("");

      return `<row r="${reference}" ht="18.6" customHeight="1">${cells}</row>`;
    })
    .join("");

  const lastColumn = columnName(COLUMNS.length);
  const lastRow = rows.length + 2;

  /* Sin cuadrícula y con el encabezado congelado, como la hoja original: los
     bordes de cada celda ya dibujan la rejilla, y encimarle la cuadrícula de
     Excel se ve sucio al imprimir. */
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastColumn}${lastRow}"/>
<sheetViews><sheetView showGridLines="0" tabSelected="1" zoomScale="85" zoomScaleNormal="85" workbookViewId="0">
<pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/>
</sheetView></sheetViews>
<sheetFormatPr baseColWidth="10" defaultColWidth="11.42578125" defaultRowHeight="18.6" customHeight="1"/>
<cols>${cols}</cols>
<sheetData>
<row r="1" ht="31.5" hidden="1" customHeight="1"/>
<row r="2" ht="29.25" customHeight="1">${headerCells}</row>
${body}
</sheetData>
<autoFilter ref="A2:${lastColumn}${lastRow}"/>
<pageMargins left="0.2" right="0.17" top="0.748" bottom="0.748" header="0.315" footer="0.315"/>
<pageSetup scale="70" orientation="landscape"/>
</worksheet>`;
}

/** Un `xf` del libro. Se arma a mano para que el orden quede explícito. */
function xf(
  numFmtId: number,
  fontId: number,
  fillId: number,
  wrap = false,
): string {
  const alignment = `<alignment horizontal="center" vertical="center"${wrap ? ' wrapText="1"' : ""}/>`;

  return `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${BORDER_GRID}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${alignment}</xf>`;
}

/* Rellenos. Los dos primeros los reserva Excel y no se pueden reordenar. */
const FILL_WHITE = 2;
const FILL_CYAN = 3;
const FILL_CREAM = 4;
const FILL_GREEN = 5;
const FILL_YELLOW = 6;
const FILL_RED = 7;

const FONT_NORMAL = 0;
const FONT_BOLD = 1;
/** Letra blanca: sobre el rojo del semáforo, la negra no se lee. */
const FONT_WHITE = 2;

/** Borde fino en las cuatro caras: la rejilla que delimita cada dato. */
const BORDER_GRID = 1;

const NUM_GENERAL = 0;
const NUM_DATE = 15;
const NUM_PERCENT0 = 9;
const NUM_PERCENT2 = 10;
const NUM_AVERAGE = 164;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="${NUM_AVERAGE}" formatCode="0.000"/></numFmts>
<fonts count="3">
<font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="${WHITE}"/><name val="Calibri"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${WHITE}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${CYAN}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${CREAM}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${GREEN}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${YELLOW}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${RED}"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
${xf(NUM_GENERAL, FONT_BOLD, FILL_CYAN, true)}
${xf(NUM_GENERAL, FONT_BOLD, FILL_CREAM, true)}
${xf(NUM_GENERAL, FONT_NORMAL, FILL_WHITE)}
${xf(NUM_GENERAL, FONT_NORMAL, FILL_CREAM)}
${xf(NUM_DATE, FONT_NORMAL, FILL_WHITE)}
${xf(NUM_PERCENT0, FONT_NORMAL, FILL_WHITE)}
${xf(NUM_AVERAGE, FONT_NORMAL, FILL_CREAM)}
${xf(NUM_PERCENT2, FONT_NORMAL, FILL_GREEN)}
${xf(NUM_PERCENT2, FONT_NORMAL, FILL_YELLOW)}
${xf(NUM_PERCENT2, FONT_WHITE, FILL_RED)}
${xf(NUM_PERCENT2, FONT_NORMAL, FILL_CREAM)}
</cellXfs>
</styleSheet>`;

/** El .xlsx del concentrado, listo para descargar. */
export function buildCutReportWorkbook(rows: ReportRow[]): Buffer {
  return createZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="REPORTE  DE  CORTE  GENERAL" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: "xl/styles.xml", content: STYLES_XML },
    { name: "xl/worksheets/sheet1.xml", content: buildSheet(rows) },
  ]);
}
