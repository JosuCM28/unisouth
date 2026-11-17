import type {
  PackingList,
  PackingListBoxGroup,
  PackingListRow,
  PackingListSummaryLine,
} from "@/lib/packing/packing-list";
import { grandTotalLabel, subtotalLabel } from "@/lib/packing/packing-list-format";
import { toXlsxDocument, type SheetRow } from "./xlsx";

/**
 * El packing list en Excel, con el acomodo de la hoja de papel de la casa
 * (formato F12-POP01): membrete, Cliente / Fecha / Elaboró y la tabla
 * Orden · Destino · Descripción · Color · Caja · Tallas · Cantidad.
 *
 * Lo que se le agregó al papel: subtotal por caja con peso y medidas, el
 * resumen por prenda, color y talla, y las firmas. Los totales son FÓRMULAS
 * con su resultado ya escrito: se leen en cualquier visor y, si alguien
 * corrige una cantidad en el archivo, se mueven solos.
 */
const WIDTHS = [12, 14, 36, 14, 8, 10, 12];
const LAST = WIDTHS.length;
const QTY = "G";
const TABLE_HEADERS = ["ORDEN", "DESTINO", "DESCRIPCIÓN", "COLOR", "CAJA", "TALLAS", "CANTIDAD"];
/** Filas del membrete y el encabezado de la tabla: se repiten en cada hoja impresa. */
const HEADER_ROWS = 7;

export function buildPackingListWorkbook(list: PackingList): Buffer {
  const rows: SheetRow[] = [...letterhead(list), tableHeader()];
  const subtotalCells: string[] = [];

  for (const group of list.groups) {
    const first = rows.length + 1;
    rows.push(...group.rows.map((row, index) => lineRow(row, index === 0 ? group.boxNumber : null)));
    const last = rows.length;
    rows.push(subtotalRow(group, first, last));
    subtotalCells.push(`${QTY}${rows.length}`);
  }

  rows.push(grandTotalRow(list, subtotalCells));
  rows.push(...summaryBlock(list.summary, list.totalPieces, rows.length));
  rows.push(...notesBlock(list.notes));
  rows.push(...signatures(list));

  return toXlsxDocument(rows, WIDTHS, "Packing list", { fitToWidth: true, repeatRows: `1:${HEADER_ROWS}` });
}

function letterhead(list: PackingList): SheetRow[] {
  return [
    [
      { value: "PACKING-LIST", style: "title", mergeTo: 5 },
      { at: 6, value: list.formatCode, style: "gridHeader", mergeTo: LAST },
    ],
    [
      { value: list.preliminary ? "PRELIMINAR · el pedido sigue abierto" : "", style: "label", mergeTo: 5 },
      { at: 6, value: list.revision, style: "cell", mergeTo: LAST },
    ],
    [],
    [
      { value: "CLIENTE:", style: "label" },
      { value: list.client, style: "cellStrong", mergeTo: 4 },
      { at: 5, value: "PEDIDO:", style: "label" },
      { at: 6, value: list.code, style: "cell", mergeTo: LAST },
    ],
    [
      { value: "FECHA:", style: "label" },
      { value: list.date, kind: "date", style: "cellStrong", mergeTo: 4 },
      { at: 5, value: "ELABORÓ:", style: "label" },
      { at: 6, value: list.preparedBy, style: "cell", mergeTo: LAST },
    ],
    [],
  ];
}

function tableHeader(): SheetRow {
  return TABLE_HEADERS.map((value) => ({ value, style: "gridHeader" as const }));
}

/** El número de caja sólo en su primer renglón, como en el papel. */
function lineRow(row: PackingListRow, boxNumber: number | null): SheetRow {
  return [
    { value: row.orderRef, style: "cell" },
    { value: row.destination, style: "cell" },
    { value: row.description, style: "cell" },
    { value: row.color, style: "cell" },
    boxNumber === null ? { value: "", style: "cell" } : { value: boxNumber, kind: "number", style: "cellStrong" },
    { value: row.size, style: "cell" },
    { value: row.quantity, kind: "number", style: "cellNumber" },
  ];
}

function subtotalRow(group: PackingListBoxGroup, first: number, last: number): SheetRow {
  return [
    { value: subtotalLabel(group), style: "gridTotal", mergeTo: LAST - 1 },
    { at: LAST, formula: `SUM(${QTY}${first}:${QTY}${last})`, value: group.pieces, style: "gridTotalNumber" },
  ];
}

function grandTotalRow(list: PackingList, subtotalCells: string[]): SheetRow {
  const formula = subtotalCells.length > 0 ? `SUM(${subtotalCells.join(",")})` : undefined;
  return [
    { value: grandTotalLabel(list), style: "gridTotal", mergeTo: LAST - 1 },
    { at: LAST, formula, value: list.totalPieces, style: "gridTotalNumber" },
  ];
}

/** Descripción en A:C, color en D, talla en E:F y piezas en G. */
function summaryBlock(summary: PackingListSummaryLine[], total: number, offset: number): SheetRow[] {
  const first = offset + 4;
  const last = first + summary.length - 1;
  return [
    [],
    [{ value: "RESUMEN DEL PEDIDO", style: "section", mergeTo: LAST }],
    [
      { value: "DESCRIPCIÓN", style: "gridHeader", mergeTo: 3 },
      { at: 4, value: "COLOR", style: "gridHeader" },
      { at: 5, value: "TALLA", style: "gridHeader", mergeTo: 6 },
      { at: 7, value: "PIEZAS", style: "gridHeader" },
    ],
    ...summary.map((line): SheetRow => [
      { value: line.description, style: "cell", mergeTo: 3 },
      { at: 4, value: line.color, style: "cell" },
      { at: 5, value: line.size, style: "cell", mergeTo: 6 },
      { at: 7, value: line.pieces, kind: "number", style: "cellNumber" },
    ]),
    [
      { value: "TOTAL", style: "gridTotal", mergeTo: LAST - 1 },
      {
        at: LAST,
        formula: summary.length > 0 ? `SUM(${QTY}${first}:${QTY}${last})` : undefined,
        value: total,
        style: "gridTotalNumber",
      },
    ],
  ];
}

function notesBlock(notes: string): SheetRow[] {
  if (!notes) return [];
  return [[], [{ value: "NOTAS:", style: "label" }, { value: notes, style: "cell", mergeTo: LAST }]];
}

/**
 * Tres casillas: el espacio para firmar arriba, el nombre y quién es. Van
 * cuadriculadas porque las líneas de pantalla no salen en el papel.
 */
function signatures(list: PackingList): SheetRow[] {
  return [
    [],
    [],
    [
      { value: "", style: "cell", mergeTo: 2 },
      { at: 3, value: "", style: "cell", mergeTo: 4 },
      { at: 5, value: "", style: "cell", mergeTo: LAST },
    ],
    [
      { value: list.preparedBy, style: "cell", mergeTo: 2 },
      { at: 3, value: list.reviewedBy, style: "cell", mergeTo: 4 },
      { at: 5, value: list.receivedBy, style: "cell", mergeTo: LAST },
    ],
    [
      { value: "ELABORÓ", style: "gridHeader", mergeTo: 2 },
      { at: 3, value: "REVISÓ", style: "gridHeader", mergeTo: 4 },
      { at: 5, value: "RECIBIÓ (TRANSPORTISTA)", style: "gridHeader", mergeTo: LAST },
    ],
  ];
}
