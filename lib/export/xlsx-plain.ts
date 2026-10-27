import { createZip } from "./zip";

/** Una celda cruda: texto o número, sin formato. */
export type PlainCell = string | number;

/**
 * Un .xlsx de puros datos, para que lo lea OTRO sistema y no una persona.
 *
 * Existe aparte de `toXlsx` porque aquél escribe para quien abre el archivo:
 * encabezados en negritas, panel congelado, autofiltro, números con separador
 * de miles. Todo eso estorba cuando el archivo lo consume un importador
 * —Microsip toma la fila 1 como dato, así que un encabezado entra como un
 * artículo más—.
 *
 * Los textos van en la tabla de cadenas compartidas y no como `inlineStr`:
 * Excel entiende las dos, pero hay lectores de .xlsx que sólo conocen la
 * primera, y aquí el que lee no es Excel.
 */
export function toPlainXlsx(rows: PlainCell[][], tabName = "Datos"): Buffer {
  const strings: string[] = [];
  const stringIndex = new Map<string, number>();

  const indexOf = (text: string) => {
    const known = stringIndex.get(text);
    if (known !== undefined) return known;
    strings.push(text);
    stringIndex.set(text, strings.length - 1);
    return strings.length - 1;
  };

  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
          if (typeof value === "number") return `<c r="${reference}"><v>${value}</v></c>`;
          return `<c r="${reference}" t="s"><v>${indexOf(value)}</v></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const sharedStrings = strings
    .map((text) => `<si><t xml:space="preserve">${escapeXml(text)}</t></si>`)
    .join("");

  return createZip([
    { name: "[Content_Types].xml", content: CONTENT_TYPES },
    { name: "_rels/.rels", content: ROOT_RELS },
    { name: "xl/workbook.xml", content: workbookXml(tabName) },
    { name: "xl/_rels/workbook.xml.rels", content: WORKBOOK_RELS },
    { name: "xl/styles.xml", content: STYLES },
    {
      name: "xl/sharedStrings.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${sharedStrings}</sst>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
    },
  ]);
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Un carácter de control vuelve inválido el archivo entero.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function workbookXml(tabName: string): string {
  const name = escapeXml(tabName.replace(/[\/?*[\]:]/g, " ").slice(0, 31)) || "Datos";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

/* El mínimo que exige el formato: una fuente, los dos rellenos reservados,
   un borde y un estilo de celda. Nada de formato numérico: el importador lee
   el valor, y un separador de miles sólo podría confundirlo. */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`;
