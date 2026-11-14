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
const WIDTHS = [16, 40, 10, 18, 12];

const HEADERS = ["Tipo", "Producto", "Talla", "PO", "Piezas"];

function tableHeader(): SheetRow {
  return HEADERS.map((value, index) => ({
    value,
    style: index === HEADERS.length - 1 ? "tableHeaderRight" : "tableHeader",
  }));
}

function lineRow(line: PackingListLine): SheetRow {
  return [
    { value: line.category, style: "cell" },
    { value: line.product, style: "cell" },
    { value: line.size, style: "cell" },
    { value: line.po, style: "cell" },
    { value: line.pieces, kind: "number", style: "cellNumber" },
  ];
}

function totalRow(label: string, pieces: number): SheetRow {
  return [
    { value: label, style: "gridTotal", mergeTo: 4 },
    { at: 5, value: pieces, kind: "number", style: "gridTotalNumber" },
  ];
}

function block(title: string, lines: PackingListLine[], pieces: number): SheetRow[] {
  return [
    [],
    [{ value: title, style: "section", mergeTo: WIDTHS.length }],
    tableHeader(),
    ...lines.map(lineRow),
    totalRow("Total", pieces),
  ];
}

export function buildPackingListWorkbook(list: PackingList): Buffer {
  const rows: SheetRow[] = [
    [{ value: "PACKING LIST", style: "title" }, { at: 5, value: list.code, style: "titleRight" }],
    ...(list.preliminary ? [[{ value: "PRELIMINAR · el pedido sigue abierto", style: "label" as const }]] : []),
    [{ value: "Pedido", style: "label" }, { value: list.name }],
    [{ value: "Cliente", style: "label" }, { value: list.client }],
    [{ value: "Fecha", style: "label" }, { value: list.date, kind: "date" }],
    [{ value: "Cajas", style: "label" }, { value: list.totalBoxes, kind: "number" }],
    [{ value: "Piezas", style: "label" }, { value: list.totalPieces, kind: "number" }],
    ...list.boxes.flatMap((box) => block(`CAJA ${box.number}`, box.lines, box.pieces)),
    ...block("RESUMEN DEL PEDIDO", list.summary, list.totalPieces),
  ];

  return toXlsxDocument(rows, WIDTHS, "Packing list", { fitToWidth: true });
}
