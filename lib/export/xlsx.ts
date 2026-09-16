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
export type CellKind =
  | "text"
  | "number"
  | "date"
  | "datetime"
  /* Porcentaje. El valor viaja en TANTO POR UNO —0.02, no 2— porque así lo
     entiende Excel: si se manda ya multiplicado sale "200%". Quien lo recibe
     puede cambiar los decimales sin rehacer la cuenta. */
  | "percent"
  /* Porcentaje SIN decimales, para el excedente. La hoja lo trae redondeado a
     entero porque es un vistazo —"se pasó un 2%"— y no una medición: los dos
     decimales se reservan para la retacería, que sí se compara contra un
     umbral. */
  | "percent0"
  /* Tres decimales fijos, para el promedio real. Con el formato general, un
     1.163 y un 1.16 se alinean distinto y la columna deja de leerse de
     corrido, que es justo para lo que sirve. */
  | "decimal3";

/** Fondo sólido de una celda, para una columna que se lee como semáforo. */
export type CellFlag = "ok" | "warn";

export interface XlsxColumn<T> {
  header: string;
  value: (row: T) => string | number | Date | null | undefined;
  kind?: CellKind;
  /** Ancho en caracteres. Sin él se calcula del encabezado. */
  width?: number;
  /**
   * Pinta la celda de verde o amarillo según la fila.
   *
   * Existe porque la hoja de papel que este archivo reemplaza viene así, y el
   * color es lo primero que se busca al revisarla: sin él, quien recibe el
   * Excel tendría que leer columna por columna para encontrar los cortes que
   * se pasaron. Devolver `undefined` deja la celda sin fondo.
   */
  flag?: (row: T) => CellFlag | undefined;
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
const STYLE_INTEGER = 5;
const STYLE_TITLE = 6;
const STYLE_TITLE_RIGHT = 7;
const STYLE_BOLD = 8;
const STYLE_SECTION = 9;
const STYLE_TABLE_HEADER = 10;
const STYLE_TABLE_HEADER_RIGHT = 11;
const STYLE_TOTAL = 12;
const STYLE_TOTAL_NUMBER = 13;
const STYLE_RIGHT = 14;
const STYLE_PERCENT = 15;
const STYLE_PERCENT0 = 19;
const STYLE_DECIMAL3 = 16;
/* El semáforo de la retacería: fondo sólido, como en la hoja de papel. Verde
   si el tendido salió dentro de lo esperado, amarillo si se pasó. */
const STYLE_PERCENT_OK = 17;
const STYLE_PERCENT_WARN = 18;

/** Los tipos numéricos que traen su propio formato. */
const PERCENT_STYLES: Record<"percent" | "percent0" | "decimal3", number> = {
  percent: STYLE_PERCENT,
  percent0: STYLE_PERCENT0,
  decimal3: STYLE_DECIMAL3,
};

/** Estilos de porcentaje con fondo, por bandera. */
const FLAG_STYLES: Record<CellFlag, number> = {
  ok: STYLE_PERCENT_OK,
  warn: STYLE_PERCENT_WARN,
};

function renderCell(
  reference: string,
  value: string | number | Date | null | undefined,
  kind: CellKind,
  flag?: CellFlag,
): string {
  if (value === null || value === undefined || value === "") {
    return `<c r="${reference}"/>`;
  }

  /* El semáforo manda sobre el formato por tipo: su estilo ya trae el formato
     de porcentaje, y sólo se pide en columnas que lo son. */
  if (flag) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) {
      return `<c r="${reference}" s="${FLAG_STYLES[flag]}"><v>${numeric}</v></c>`;
    }
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

  if (kind === "percent" || kind === "percent0" || kind === "decimal3") {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) {
      const style = PERCENT_STYLES[kind];
      return `<c r="${reference}" s="${style}"><v>${numeric}</v></c>`;
    }
  }

  if (kind === "number") {
    const numeric = typeof value === "number" ? value : Number(value);
    /* Un número que no lo es saldría como `NaN` y Excel marcaría la celda
       como error; es preferible dejarla caer a texto y que se lea el valor
       original, que al menos dice qué se capturó. */
    if (Number.isFinite(numeric)) {
      /* Entero y decimal llevan formato DISTINTO. Con `#,##0.##` para todo,
         Excel le deja el punto colgando a los enteros —610 se lee "610."— y
         una columna de piezas sale entera así. Las piezas se cuentan enteras
         y los metros no, y cada uno necesita el suyo. */
      const style = Number.isInteger(numeric) ? STYLE_INTEGER : STYLE_NUMBER;
      return `<c r="${reference}" s="${style}"><v>${numeric}</v></c>`;
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
            column.flag?.(row),
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
 * Los de la tabla —encabezado en negritas sobre gris, fecha, número— y los
 * que necesita una hoja con forma de documento: título, encabezado de
 * sección, encabezado de tabla y renglón de totales.
 *
 * El formato 14 es el de fecha corta LOCAL y el 22 el de fecha con hora, así
 * que respetan la configuración de quien abre el archivo en vez de imponerle
 * el orden mexicano a una máquina en inglés.
 */
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="5"><numFmt numFmtId="164" formatCode="#,##0.##"/><numFmt numFmtId="165" formatCode="#,##0"/><numFmt numFmtId="166" formatCode="0.00%"/><numFmt numFmtId="167" formatCode="0.000"/><numFmt numFmtId="168" formatCode="0%"/></numFmts>
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
</fonts>
<fills count="5">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF00B050"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="4">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FF94A3B8"/></bottom><diagonal/></border>
<border><left/><right/><top/><bottom style="medium"><color rgb="FF0F172A"/></bottom><diagonal/></border>
<border><left/><right/><top style="thin"><color rgb="FF0F172A"/></top><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="20">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="22" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="3" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="165" fontId="1" fillId="0" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
<xf numFmtId="166" fontId="0" fillId="4" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
<xf numFmtId="168" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
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
  return packageWorkbook(buildSheet(rows, columns), tabName);
}

/** Mete la hoja en el .xlsx. Lo de alrededor es igual para toda hoja. */
function packageWorkbook(sheetXml: string, tabName: string): Buffer {
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
<calcPr calcId="0" fullCalcOnLoad="1"/>
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
    { name: "xl/worksheets/sheet1.xml", content: sheetXml },
  ]);
}

/** Estilos con nombre para una hoja con forma de documento. */
export type SheetStyle =
  | "title"
  | "titleRight"
  | "right"
  | "label"
  | "section"
  | "tableHeader"
  | "tableHeaderRight"
  | "total"
  | "totalNumber";

const SHEET_STYLES: Record<SheetStyle, number> = {
  title: STYLE_TITLE,
  titleRight: STYLE_TITLE_RIGHT,
  right: STYLE_RIGHT,
  label: STYLE_BOLD,
  section: STYLE_SECTION,
  tableHeader: STYLE_TABLE_HEADER,
  tableHeaderRight: STYLE_TABLE_HEADER_RIGHT,
  total: STYLE_TOTAL,
  totalNumber: STYLE_TOTAL_NUMBER,
};

export interface SheetCell {
  /** Columna 1-based. Sin ella, la siguiente a la de la celda anterior. */
  at?: number;
  value?: string | number | Date | null;
  kind?: CellKind;
  style?: SheetStyle;
  /**
   * Fórmula de Excel, SIN el `=` de adelante (`SUM(B10:E10)`).
   *
   * Existe porque hay hojas que no se mandan para leerse sino para EDITARSE:
   * el concentrado de un pedido llega con las cantidades puestas, pero quien
   * lo recibe corrige una talla y espera que el total se mueva solo. Con el
   * número ya calculado esa corrección deja la hoja mintiendo, y el error no
   * se ve porque la suma sigue ahí, bien formateada y equivocada.
   *
   * Manda sobre `value`: una celda con fórmula no lleva valor de respaldo, y
   * el libro se abre con `fullCalcOnLoad` para que Excel la resuelva de
   * entrada en vez de mostrar una celda en blanco.
   */
  formula?: string;
  /**
   * Última columna de la fusión, 1-based. `at: 1, mergeTo: 6` fusiona A:F.
   *
   * Sólo el ancla lleva contenido; las demás celdas del rango se escriben
   * vacías con el mismo estilo, que es lo que hace que el relleno y el borde
   * del bloque no se corten a media fusión.
   */
  mergeTo?: number;
}

/** Un renglón del documento. Vacío = renglón en blanco, que separa bloques. */
export type SheetRow = SheetCell[];

/**
 * Una hoja con forma de DOCUMENTO, no de tabla.
 *
 * `toXlsx` sirve para una lista: una rejilla con su encabezado, su filtro y su
 * panel congelado, que es lo que se quiere para pivotear. Pero un vale o una
 * orden no son una lista —son una hoja con bloques: un título, unos datos
 * apareados, una tabla con su total y una bitácora abajo— y aplanarlos a
 * rejilla obliga a inventar una columna "Sección" que en el papel no existe.
 *
 * Aquí cada renglón dice qué celdas lleva y en qué columna, así que la hoja
 * sale con la misma forma con la que se imprime.
 *
 * No lleva autofiltro ni panel congelado a propósito: filtrar un documento por
 * una de sus columnas lo desarma.
 */
export function toXlsxDocument(
  rows: SheetRow[],
  widths: number[],
  tabName = "Datos",
): Buffer {
  return packageWorkbook(buildDocumentSheet(rows, widths), tabName);
}

function buildDocumentSheet(rows: SheetRow[], widths: number[]): string {
  const cols = widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join("");

  const merges: string[] = [];

  const body = rows
    .map((cells, rowIndex) => {
      const reference = rowIndex + 1;
      if (cells.length === 0) return `<row r="${reference}"/>`;

      let column = 0;
      const rendered = cells
        .map((cell) => {
          column = cell.at ?? column + 1;
          const anchor = `${columnName(column)}${reference}`;

          if (!cell.mergeTo || cell.mergeTo <= column) {
            return renderSheetCell(anchor, cell);
          }

          merges.push(`${anchor}:${columnName(cell.mergeTo)}${reference}`);

          /* Las celdas tapadas se escriben vacías y CON el estilo del ancla.
             Excel no hereda el formato dentro de una fusión: sin ellas, un
             título sobre fondo sólido se pinta sólo hasta donde llega su
             primera columna y el bloque sale cortado a la mitad. */
          const covered: string[] = [];
          for (let next = column + 1; next <= cell.mergeTo; next += 1) {
            covered.push(
              renderSheetCell(`${columnName(next)}${reference}`, {
                style: cell.style,
              }),
            );
          }

          // La última tapada deja el cursor donde termina la fusión.
          column = cell.mergeTo;

          return renderSheetCell(anchor, cell) + covered.join("");
        })
        .join("");

      return `<row r="${reference}">${rendered}</row>`;
    })
    .join("");

  const lastColumn = columnName(Math.max(widths.length, 1));
  const lastRow = Math.max(rows.length, 1);

  const mergeXml =
    merges.length === 0
      ? ""
      : `<mergeCells count="${merges.length}">${merges
          .map((range) => `<mergeCell ref="${range}"/>`)
          .join("")}</mergeCells>`;

  // `mergeCells` va DESPUÉS de `sheetData`: el orden de los elementos está
  // fijado por el esquema y Excel se niega a abrir el archivo si se invierte.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastColumn}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${body}</sheetData>${mergeXml}
</worksheet>`;
}

/**
 * Sin estilo se delega en `renderCell`, que ya sabe elegir formato por tipo.
 * Con estilo manda el estilo: el renglón de totales va en negritas aunque la
 * celda sea un número, y ese estilo ya trae su propio formato numérico.
 */
function renderSheetCell(reference: string, cell: SheetCell): string {
  const kind = cell.kind ?? "text";

  /* La fórmula manda sobre el valor: quien la pide quiere que la hoja se
     recalcule, no un número congelado con una fórmula decorativa al lado. */
  if (cell.formula) {
    const style = cell.style ? ` s="${SHEET_STYLES[cell.style]}"` : "";
    return `<c r="${reference}"${style}><f>${escapeXml(cell.formula)}</f></c>`;
  }

  if (!cell.style) return renderCell(reference, cell.value, kind);

  const style = SHEET_STYLES[cell.style];
  const { value } = cell;

  if (value === null || value === undefined || value === "") {
    return `<c r="${reference}" s="${style}"/>`;
  }

  if (value instanceof Date) {
    return `<c r="${reference}" s="${style}"><v>${excelSerialDate(value)}</v></c>`;
  }

  if (kind === "number") {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) {
      return `<c r="${reference}" s="${style}"><v>${numeric}</v></c>`;
    }
  }

  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
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
