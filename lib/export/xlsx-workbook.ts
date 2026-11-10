import { chartAnchorXml, chartXml, type ChartSpec } from "./xlsx-chart";
import { sheetName, STYLES_XML } from "./xlsx";
import { createZip } from "./zip";

/**
 * Un libro de VARIAS hojas, con gráficas.
 *
 * `toXlsx` y `toXlsxDocument` producen una sola hoja, y está bien para casi
 * todas las descargas. Un reporte de periodo necesita más: el resumen, las
 * gráficas y el detalle en pestañas separadas, para que quien filtra la tabla
 * no desarme la portada.
 *
 * Las hojas llegan ya escritas (`tableSheetXml` / `documentSheetXml`) con los
 * mismos estilos que el resto de las descargas; aquí sólo se empacan y se les
 * cuelgan las gráficas.
 */

export interface WorkbookSheet {
  name: string;
  /** El XML completo de la hoja. */
  xml: string;
  charts?: ChartSpec[];
}

const WORKSHEET_OPEN =
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
const WORKSHEET_OPEN_WITH_R =
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * Cuelga la hoja de dibujo. `<drawing>` va al FINAL del worksheet —el esquema
 * fija el orden y Excel se niega a abrir el archivo si va antes de la
 * configuración de impresión—, y su `r:id` necesita el espacio de nombres.
 */
function withDrawing(xml: string): string {
  return xml
    .replace(WORKSHEET_OPEN, WORKSHEET_OPEN_WITH_R)
    .replace("</worksheet>", '<drawing r:id="rId1"/></worksheet>');
}

function relationships(entries: { id: string; type: string; target: string }[]) {
  const body = entries
    .map(
      (entry) =>
        `<Relationship Id="${entry.id}" Type="${REL}/${entry.type}" Target="${entry.target}"/>`,
    )
    .join("");
  return `${XML_HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
}

function contentTypes(sheetCount: number, drawings: number[], chartCount: number) {
  const sheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  const drawingTypes = drawings
    .map(
      (number) =>
        `<Override PartName="/xl/drawings/drawing${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
    )
    .join("");
  const charts = Array.from(
    { length: chartCount },
    (_, index) =>
      `<Override PartName="/xl/charts/chart${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
  ).join("");

  return `${XML_HEAD}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets}${drawingTypes}${charts}
</Types>`;
}

function workbookXml(sheets: WorkbookSheet[]): string {
  const entries = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${sheetName(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");

  return `${XML_HEAD}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}">
<sheets>${entries}</sheets><calcPr calcId="0" fullCalcOnLoad="1"/>
</workbook>`;
}

interface ZipEntry {
  name: string;
  content: string;
}

/** La hoja de dibujo de una pestaña y las gráficas que cuelgan de ella. */
function drawingParts(
  charts: ChartSpec[],
  drawingNumber: number,
  firstChart: number,
): ZipEntry[] {
  const anchors = charts.map((chart, index) => chartAnchorXml(chart, index)).join("");
  const chartRels = charts.map((_, index) => ({
    id: `rId${index + 1}`,
    type: "chart",
    target: `../charts/chart${firstChart + index}.xml`,
  }));

  return [
    {
      name: `xl/drawings/drawing${drawingNumber}.xml`,
      content: `${XML_HEAD}
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors}</xdr:wsDr>`,
    },
    {
      name: `xl/drawings/_rels/drawing${drawingNumber}.xml.rels`,
      content: relationships(chartRels),
    },
    ...charts.map((chart, index) => ({
      name: `xl/charts/chart${firstChart + index}.xml`,
      content: chartXml(chart),
    })),
  ];
}

export function toXlsxWorkbook(sheets: WorkbookSheet[]): Buffer {
  const entries: ZipEntry[] = [];
  const drawings: number[] = [];
  let chartCount = 0;

  sheets.forEach((sheet, index) => {
    const number = index + 1;
    const charts = sheet.charts ?? [];

    if (charts.length === 0) {
      entries.push({ name: `xl/worksheets/sheet${number}.xml`, content: sheet.xml });
      return;
    }

    /* Una hoja de dibujo por pestaña, numerada como la pestaña: así el
       vínculo hoja → dibujo es siempre rId1 y no hace falta llevar cuentas. */
    drawings.push(number);
    entries.push(
      { name: `xl/worksheets/sheet${number}.xml`, content: withDrawing(sheet.xml) },
      {
        name: `xl/worksheets/_rels/sheet${number}.xml.rels`,
        content: relationships([
          { id: "rId1", type: "drawing", target: `../drawings/drawing${number}.xml` },
        ]),
      },
      ...drawingParts(charts, number, chartCount + 1),
    );
    chartCount += charts.length;
  });

  const workbookRels = [
    ...sheets.map((_, index) => ({
      id: `rId${index + 1}`,
      type: "worksheet",
      target: `worksheets/sheet${index + 1}.xml`,
    })),
    { id: `rId${sheets.length + 1}`, type: "styles", target: "styles.xml" },
  ];

  return createZip([
    { name: "[Content_Types].xml", content: contentTypes(sheets.length, drawings, chartCount) },
    {
      name: "_rels/.rels",
      content: relationships([
        { id: "rId1", type: "officeDocument", target: "xl/workbook.xml" },
      ]),
    },
    { name: "xl/workbook.xml", content: workbookXml(sheets) },
    { name: "xl/_rels/workbook.xml.rels", content: relationships(workbookRels) },
    { name: "xl/styles.xml", content: STYLES_XML },
    ...entries,
  ]);
}
