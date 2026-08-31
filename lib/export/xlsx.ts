import { createZip } from "./zip";
import { EXPORT_ROW_LIMIT } from "./limits";
import { todayInputValue } from "@/lib/utils";

/**
 * Generación de archivos .xlsx de verdad.
 *
 * El CSV que se usaba antes lo abre Excel, sí, pero manda TODO como texto: las
 * cantidades no se suman sin convertirlas a mano, las fechas se interpretan
 * según la configuración regional de quien abre —y en una máquina en inglés
 * "03/08" es 8 de marzo, no 3 de agosto— y las columnas salen del ancho de la
 * primera celda. Para un archivo que se manda por correo a alguien que no
 * tiene la app enfrente, eso significa que su primer trabajo es arreglarlo.
 *
 * Aquí los números viajan como números, los encabezados van en negritas y
 * congelados, y cada columna sale con un ancho utilizable.
 *
 * Se escribe a mano y no con una librería por la misma razón que el CSV:
 * `xlsx` de npm arrastra vulnerabilidades sin parchar, y no vale meter eso en
 * el servidor para generar una tabla.
 */

/** Cómo se escribe una celda en la hoja. */
export type CellKind = "text" | "number" | "date" | "datetime";

export interface XlsxColumn<T> {
  header: string;
  value: (row: T) => string | number | Date | null | undefined;
  kind?: CellKind;
  /** Ancho en caracteres. Sin él se calcula del encabezado. */
  width?: number;
}

/** Escapa lo que no puede ir crudo dentro de un XML. */
function escapeXml(value: string): string {
  return (
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      /* Los caracteres de control rompen el XML y Excel se niega a abrir el
         archivo ENTERO. Un carácter raro pegado en un campo de notas basta
         para inutilizar la descarga, así que se limpian en vez de confiar. */
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
  );
}

/** Referencia de columna en notación de Excel: 1 → A, 27 → AA. */
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
 * La base es el 30 de diciembre de 1899 y no el 1 de enero de 1900 porque
 * Excel cree que el 29 de febrero de 1900 existió —un error heredado de Lotus
 * 1-2-3 que conserva por compatibilidad—. Sin reproducirlo, todas las fechas
 * salen corridas un día.
 */
function excelSerialDate(date: Date): number {
  const epoch = Date.UTC(1899, 11, 30);
  const utc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  );

  return (utc - epoch) / 86_400_000;
}

/** Índices del `cellXfs` de abajo. */
const STYLE_HEADER = 1;
const STYLE_DATE = 2;
const STYLE_NUMBER = 3;
const STYLE_DATETIME = 4;

function renderCell(
  reference: string,
  value: string | number | Date | null | undefined,
  kind: CellKind,
): string {
  if (value === null || value === undefined || value === "") {
    return `<c r="${reference}"/>`;
  }

  if (kind === "date" && value instanceof Date) {
    return `<c r="${reference}" s="${STYLE_DATE}"><v>${excelSerialDate(value)}</v></c>`;
  }

  /* La hora importa en una bitácora: dos avances del mismo día se ven iguales
     con formato de fecha corta y se pierde el orden entre ellos, que es justo
     lo que se va a revisar. El número de serie es el mismo; cambia el formato. */
  if (kind === "datetime" && value instanceof Date) {
    return `<c r="${reference}" s="${STYLE_DATETIME}"><v>${excelSerialDate(value)}</v></c>`;
  }

  if (kind === "number") {
    const numeric = typeof value === "number" ? value : Number(value);
    /* Un número que no lo es saldría como `NaN` y Excel marcaría la celda
       como error; es preferible dejarla caer a texto y que se lea el valor
       original, que al menos dice qué se capturó. */
    if (Number.isFinite(numeric)) {
      return `<c r="${reference}" s="${STYLE_NUMBER}"><v>${numeric}</v></c>`;
    }
  }

  /* `inlineStr` en vez de la tabla de cadenas compartidas: pesa un poco más,
     pero evita mantener un índice global y sus colisiones. Con archivos de
     miles de filas —no de millones— la diferencia no se nota. */
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

/** Ancho utilizable: el del encabezado, con un mínimo y un máximo cuerdos. */
function defaultWidth(header: string): number {
  return Math.min(40, Math.max(10, header.length + 4));
}

function buildSheet<T>(rows: T[], columns: XlsxColumn<T>[]): string {
  const cols = columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? defaultWidth(column.header)}" customWidth="1"/>`,
    )
    .join("");

  const headerCells = columns
    .map(
      (column, index) =>
        `<c r="${columnName(index + 1)}1" s="${STYLE_HEADER}" t="inlineStr"><is><t>${escapeXml(column.header)}</t></is></c>`,
    )
    .join("");

  const bodyRows = rows
    .map((row, rowIndex) => {
      const cells = columns
        .map((column, index) =>
          renderCell(
            `${columnName(index + 1)}${rowIndex + 2}`,
            column.value(row),
            column.kind ?? "text",
          ),
        )
        .join("");

      return `<row r="${rowIndex + 2}">${cells}</row>`;
    })
    .join("");

  const lastColumn = columnName(columns.length);
  const lastRow = rows.length + 1;

  /* El filtro automático y el panel congelado no son adorno: quien recibe el
     archivo lo primero que hace es ordenar por una columna, y sin el
     encabezado fijo pierde de vista qué está mirando a la fila veinte. */
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastColumn}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0">
<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData><row r="1">${headerCells}</row>${bodyRows}</sheetData>
<autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`;
}

/**
 * Los estilos del libro.
 *
 * Tres nada más: encabezado en negritas sobre gris, fecha y número con
 * separador de miles. El formato 14 es el de fecha corta LOCAL, así que
 * respeta la configuración de quien abre el archivo en vez de imponerle el
 * orden mexicano a una máquina en inglés.
 */
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.##"/></numFmts>
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FF94A3B8"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="22" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;

/** El nombre de la pestaña. Excel prohíbe 31+ caracteres y algunos signos. */
function sheetName(name: string): string {
  return escapeXml(name.replace(/[\/?*[\]:]/g, " ").slice(0, 31)) || "Datos";
}

export function toXlsx<T>(
  rows: T[],
  columns: XlsxColumn<T>[],
  tabName = "Datos",
): Buffer {
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
<sheets><sheet name="${sheetName(tabName)}" sheetId="1" r:id="rId1"/></sheets>
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
    { name: "xl/worksheets/sheet1.xml", content: buildSheet(rows, columns) },
  ]);
}

/** Respuesta de descarga con el nombre y la fecha del día. */
export function xlsxResponse(file: Buffer, filename: string): Response {
  // El día EN LA FÁBRICA: con toISOString, un archivo bajado a las 7 de la
  // noche salía con la fecha de mañana en el nombre.
  const stamp = todayInputValue();

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}-${stamp}.xlsx"`,
      "Content-Length": String(file.length),
    },
  });
}

/**
 * Escribe el libro agregando un AVISO al pie cuando el archivo se topó.
 *
 * El aviso va como última fila y no se calla: un Excel truncado en silencio es
 * peor que uno corto, porque quien lo recibe cree que lo tiene todo y decide
 * con eso. Va en la primera columna, que es donde se lee al bajar hasta el
 * final de la hoja.
 *
 * Se envuelve `toXlsx` en vez de dejarlo a cada ruta porque son seis rutas y
 * la que se olvide de avisar será justo la que entregue el dato incompleto.
 */
export function toXlsxWithNotice<T>(
  rows: T[],
  columns: XlsxColumn<T>[],
  tabName: string,
): Buffer {
  if (rows.length < EXPORT_ROW_LIMIT) return toXlsx(rows, columns, tabName);

  const limit = EXPORT_ROW_LIMIT.toLocaleString("es-MX");
  const notice = `Se alcanzó el tope de ${limit} filas. Acota el filtro para ver el resto.`;

  /* La fila del aviso es un centinela: la primera columna trae el texto y las
     demás salen vacías. Se marca con un símbolo al inicio para que no se
     confunda con un renglón de datos al ordenar la hoja. */
  const withNotice = [...rows, NOTICE_ROW as T];
  const noticeColumns: XlsxColumn<T>[] = columns.map((column, index) => ({
    ...column,
    kind: index === 0 ? "text" : column.kind,
    value: (row: T) =>
      row === (NOTICE_ROW as T)
        ? index === 0
          ? `⚠ ${notice}`
          : ""
        : column.value(row),
  }));

  return toXlsx(withNotice, noticeColumns, tabName);
}

/** Marca única de la fila de aviso. Se compara por identidad, no por forma. */
const NOTICE_ROW = Object.freeze({ __notice: true });
