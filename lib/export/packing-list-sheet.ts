import type { PackingList, PackingListLine } from "@/lib/packing/packing-list";
import { toXlsxDocument, type SheetRow } from "./xlsx";

/**
 * El packing list en Excel: el mismo papel que el PDF, con forma de
 * documento —encabezado, un bloque por caja y el resumen— para que quien lo
 * recibe lo imprima o lo reenvíe tal cual.
 *
 * Las piezas son números y no texto: lo primero que hace el cliente es
 * seleccionar la columna para ver el total.
 */
interface TextColumn {
  header: string;
  width: number;
  value: (line: PackingListLine) => string;
}

const BASE_COLUMNS: TextColumn[] = [
  { header: "Tipo", width: 16, value: (line) => line.category },
  { header: "Producto", width: 40, value: (line) => line.product },
  { header: "Talla", width: 10, value: (line) => line.size },
  { header: "PO", width: 18, value: (line) => line.po },
];

/** Sólo cuando el pedido mezcla dueños; con uno ya lo dice el encabezado. */
const CLIENT_COLUMN: TextColumn = { header: "Cliente", width: 28, value: (line) => line.client };

const PIECES_WIDTH = 12;

function columnsFor(list: PackingList): TextColumn[] {
  return list.showClient ? [...BASE_COLUMNS, CLIENT_COLUMN] : BASE_COLUMNS;
}

function tableHeader(columns: TextColumn[]): SheetRow {
  return [
    ...columns.map((column) => ({ value: column.header, style: "tableHeader" as const })),
    { value: "Piezas", style: "tableHeaderRight" },
  ];
}

function lineRow(columns: TextColumn[], line: PackingListLine): SheetRow {
  return [
    ...columns.map((column) => ({ value: column.value(line), style: "cell" as const })),
    { value: line.pieces, kind: "number", style: "cellNumber" },
  ];
}

function totalRow(columns: TextColumn[], label: string, pieces: number): SheetRow {
  return [
    { value: label, style: "gridTotal", mergeTo: columns.length },
    { at: columns.length + 1, value: pieces, kind: "number", style: "gridTotalNumber" },
  ];
}

function block(columns: TextColumn[], title: string, lines: PackingListLine[], pieces: number): SheetRow[] {
  return [
    [],
    [{ value: title, style: "section", mergeTo: columns.length + 1 }],
    tableHeader(columns),
    ...lines.map((line) => lineRow(columns, line)),
    totalRow(columns, "Total", pieces),
  ];
}

export function buildPackingListWorkbook(list: PackingList): Buffer {
  const columns = columnsFor(list);
  const last = columns.length + 1;
  const rows: SheetRow[] = [
    [{ value: "PACKING LIST", style: "title" }, { at: last, value: list.code, style: "titleRight" }],
    ...(list.preliminary ? [[{ value: "PRELIMINAR · el pedido sigue abierto", style: "label" as const }]] : []),
    [{ value: "Pedido", style: "label" }, { value: list.name }],
    [{ value: "Cliente", style: "label" }, { value: list.client }],
    [{ value: "Fecha", style: "label" }, { value: list.date, kind: "date" }],
    [{ value: "Cajas", style: "label" }, { value: list.totalBoxes, kind: "number" }],
    [{ value: "Piezas", style: "label" }, { value: list.totalPieces, kind: "number" }],
    ...list.boxes.flatMap((box) => block(columns, `CAJA ${box.number}`, box.lines, box.pieces)),
    ...block(columns, "RESUMEN DEL PEDIDO", list.summary, list.totalPieces),
  ];

  const widths = [...columns.map((column) => column.width), PIECES_WIDTH];
  return toXlsxDocument(rows, widths, "Packing list", { fitToWidth: true });
}
