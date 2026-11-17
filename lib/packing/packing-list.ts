import type { PackingOrderStatus } from "@prisma/client";
import type { PackingListData } from "./packing-list-data";

/** Un renglón tal como se imprime: lo que falta va vacío, no "—". */
export interface PackingListRow {
  orderRef: string;
  destination: string;
  description: string;
  color: string;
  size: string;
  quantity: number;
}

/** Los renglones seguidos de una misma caja, con su subtotal. */
export interface PackingListBoxGroup {
  /** `null` = renglones capturados sin caja antes de la primera. */
  boxNumber: number | null;
  rows: PackingListRow[];
  pieces: number;
  weightKg: number | null;
  dimensions: string | null;
}

export interface PackingListSummaryLine {
  description: string;
  color: string;
  size: string;
  pieces: number;
}

/**
 * El packing list ya resuelto. El PDF y el Excel lo DIBUJAN, pero qué
 * renglones lleva, cómo se agrupan y cuánto suman se decide aquí una sola
 * vez: si cada uno lo armara por su lado, tarde o temprano el Excel y el
 * papel dirían cosas distintas del mismo pedido.
 */
export interface PackingList {
  code: string;
  name: string;
  status: PackingOrderStatus;
  /** Abierto: todavía se mueve, y la hoja lo advierte. */
  preliminary: boolean;
  formatCode: string;
  revision: string;
  client: string;
  date: Date;
  preparedBy: string;
  reviewedBy: string;
  receivedBy: string;
  notes: string;
  groups: PackingListBoxGroup[];
  /** Total por descripción, color y talla de todo el pedido. */
  summary: PackingListSummaryLine[];
  totalBoxes: number;
  totalPieces: number;
  /** `null` si ninguna caja trae peso: un "0 kg" afirmaría algo falso. */
  totalWeightKg: number | null;
}

export function toPackingList(
  order: { code: string; name: string; status: PackingOrderStatus },
  data: PackingListData,
): PackingList {
  const groups = groupByBox(data);
  const weights = groups.flatMap((group) => (group.weightKg === null ? [] : [group.weightKg]));

  return {
    code: order.code,
    name: order.name,
    status: order.status,
    preliminary: order.status === "OPEN",
    formatCode: data.formatCode,
    revision: data.revision,
    client: data.client,
    date: data.date,
    preparedBy: data.preparedBy ?? "",
    reviewedBy: data.reviewedBy ?? "",
    receivedBy: data.receivedBy ?? "",
    notes: data.notes ?? "",
    groups,
    summary: summarize(data),
    totalBoxes: new Set(groups.flatMap((group) => (group.boxNumber === null ? [] : [group.boxNumber]))).size,
    totalPieces: data.lines.reduce((sum, line) => sum + line.quantity, 0),
    totalWeightKg: weights.length > 0 ? weights.reduce((sum, value) => sum + value, 0) : null,
  };
}

/**
 * Agrupa en el orden de la hoja, no ordenando: el papel manda. Un renglón
 * sin caja sigue en la caja de arriba, que es como se lee en la hoja de
 * papel —el número sólo se escribe en el primer renglón de cada caja—.
 */
function groupByBox(data: PackingListData): PackingListBoxGroup[] {
  const extras = new Map(data.boxes.map((box) => [box.boxNumber, box]));
  const groups: PackingListBoxGroup[] = [];

  for (const line of data.lines) {
    const current = groups.at(-1);
    const startsNew = !current || (line.boxNumber !== undefined && line.boxNumber !== current.boxNumber);
    const group = startsNew ? newGroup(line.boxNumber ?? null, extras) : current;
    if (startsNew) groups.push(group);
    // Una caja puede volver a aparecer más abajo (la caja 1 de camisas y la
    // caja 1 de pantalones en la hoja de papel): su peso se dice UNA vez,
    // en su primer bloque, o el total lo sumaría dos veces.
    if (startsNew && group.boxNumber !== null) extras.delete(group.boxNumber);
    group.rows.push(toRow(line));
    group.pieces += line.quantity;
  }
  return groups;
}

function newGroup(
  boxNumber: number | null,
  extras: Map<number, PackingListData["boxes"][number]>,
): PackingListBoxGroup {
  const extra = boxNumber === null ? undefined : extras.get(boxNumber);
  return {
    boxNumber,
    rows: [],
    pieces: 0,
    weightKg: extra?.weightKg ?? null,
    dimensions: extra?.dimensions ?? null,
  };
}

function toRow(line: PackingListData["lines"][number]): PackingListRow {
  return {
    orderRef: line.orderRef ?? "",
    destination: line.destination ?? "",
    description: line.description,
    color: line.color ?? "",
    size: line.size ?? "",
    quantity: line.quantity,
  };
}

/** Suma por descripción + color + talla, en el orden en que aparecen. */
function summarize(data: PackingListData): PackingListSummaryLine[] {
  const merged = new Map<string, PackingListSummaryLine>();
  for (const line of data.lines) {
    const entry = { description: line.description, color: line.color ?? "", size: line.size ?? "" };
    const key = [entry.description, entry.color, entry.size].join("|");
    const known = merged.get(key);
    if (known) known.pieces += line.quantity;
    else merged.set(key, { ...entry, pieces: line.quantity });
  }
  return [...merged.values()];
}

/** "packing-EMB-2026-0001-TAMSA-13-11-2026" sin nada que un sistema de archivos rechace. */
export function packingListFileName(list: PackingList): string {
  return `packing-${list.code}-${list.name}`.replace(/[^A-Za-z0-9-]+/g, "-").replace(/-+/g, "-");
}
