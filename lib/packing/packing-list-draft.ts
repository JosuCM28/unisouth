import { toDateInputValue } from "@/lib/utils";
import type { PackingListData } from "./packing-list-data";

/**
 * El packing list como lo edita la pantalla: todo en texto, como lo dejan
 * los inputs ("" mientras se borra para reescribir). El esquema Zod lo
 * convierte al guardar; aquí no se valida nada.
 */
export interface DraftRow {
  key: string;
  stockId: string;
  orderRef: string;
  destination: string;
  description: string;
  color: string;
  boxNumber: string;
  size: string;
  quantity: string;
}

export interface DraftBox {
  boxNumber: number;
  weightKg: string;
  dimensions: string;
}

export interface PackingListDraft {
  formatCode: string;
  revision: string;
  client: string;
  date: string;
  preparedBy: string;
  reviewedBy: string;
  receivedBy: string;
  notes: string;
  rows: DraftRow[];
  boxes: DraftBox[];
}

let nextKey = 0;
export const newRowKey = () => `row-${(nextKey += 1)}`;

export function emptyRow(boxNumber = ""): DraftRow {
  return {
    key: newRowKey(), stockId: "", orderRef: "", destination: "", description: "",
    color: "", boxNumber, size: "", quantity: "",
  };
}

/** De los datos tipados a texto. Sin Date ni Decimal: cruza al cliente tal cual. */
export function toDraft(data: PackingListData): PackingListDraft {
  return {
    formatCode: data.formatCode,
    revision: data.revision,
    client: data.client,
    date: toDateInputValue(data.date),
    preparedBy: data.preparedBy ?? "",
    reviewedBy: data.reviewedBy ?? "",
    receivedBy: data.receivedBy ?? "",
    notes: data.notes ?? "",
    rows: data.lines.map((line) => ({
      key: newRowKey(),
      stockId: line.stockId ?? "",
      orderRef: line.orderRef ?? "",
      destination: line.destination ?? "",
      description: line.description,
      color: line.color ?? "",
      boxNumber: line.boxNumber === undefined ? "" : String(line.boxNumber),
      size: line.size ?? "",
      quantity: String(line.quantity),
    })),
    boxes: data.boxes.map((box) => ({
      boxNumber: box.boxNumber,
      weightKg: box.weightKg === undefined ? "" : String(box.weightKg),
      dimensions: box.dimensions ?? "",
    })),
  };
}

/**
 * Vuelve a llenar los renglones desde las cajas SIN perder lo escrito: cada
 * renglón nuevo hereda orden, destino, descripción y color del primero que
 * venía del mismo renglón de inventario. Lo agregado a mano se va, porque no
 * hay forma de saber en qué caja quedó.
 */
export function refillRows(current: DraftRow[], fresh: DraftRow[]): DraftRow[] {
  const typed = new Map<string, DraftRow>();
  for (const row of current) {
    if (row.stockId && !typed.has(row.stockId)) typed.set(row.stockId, row);
  }
  return fresh.map((row) => {
    const previous = typed.get(row.stockId);
    if (!previous) return { ...row, key: newRowKey() };
    return {
      ...row,
      key: newRowKey(),
      orderRef: previous.orderRef,
      destination: previous.destination,
      description: previous.description,
      color: previous.color,
    };
  });
}

/**
 * Las cajas que se le piden peso y medidas: las que aparecen en los
 * renglones, conservando lo ya capturado de cada una.
 */
export function syncBoxes(rows: DraftRow[], boxes: DraftBox[]): DraftBox[] {
  const known = new Map(boxes.map((box) => [box.boxNumber, box]));
  const numbers = [...new Set(rows.map((row) => Number.parseInt(row.boxNumber, 10)))]
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b);
  return numbers.map((boxNumber) => known.get(boxNumber) ?? { boxNumber, weightKg: "", dimensions: "" });
}

export function draftPieces(rows: DraftRow[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
}

/** Lo que se manda al servidor; el esquema hace el resto. */
export function toSheetInput(orderId: string, draft: PackingListDraft) {
  const { rows, boxes, ...header } = draft;
  return {
    orderId,
    ...header,
    // La `key` es sólo de React; el esquema la ignora al no declararla.
    lines: rows,
    boxes: syncBoxes(rows, boxes),
  };
}
