import type { PackingOrderStatus } from "@prisma/client";
import type {
  PackingBoxLineRow,
  PackingOrderDetail,
} from "@/lib/repositories/packing.repository";

export const NO_PO_LABEL = "SIN PO";
export const NO_CATEGORY_LABEL = "SIN TIPO";
export const NO_CLIENT_LABEL = "SIN CLIENTE";

export interface PackingListLine {
  category: string;
  product: string;
  size: string;
  po: string;
  pieces: number;
}

export interface PackingListBox {
  number: number;
  lines: PackingListLine[];
  pieces: number;
}

/**
 * Lo que dice el packing list, ya resuelto: el PDF y el Excel lo DIBUJAN,
 * pero qué renglones lleva, en qué orden y cuánto suman se decide aquí una
 * sola vez. Si cada uno lo armara por su lado, tarde o temprano el Excel y
 * el papel dirían cosas distintas del mismo pedido.
 */
export interface PackingList {
  code: string;
  name: string;
  client: string;
  date: Date;
  status: PackingOrderStatus;
  /** Abierto: todavía se mueve, y la hoja lo advierte. */
  preliminary: boolean;
  boxes: PackingListBox[];
  /** El total por tipo, producto, talla y PO de todo el pedido. */
  summary: PackingListLine[];
  totalBoxes: number;
  totalPieces: number;
}

/** Orden del tipo de prenda (posición del catálogo) y de la talla. */
interface SortKeys {
  categoryPosition: number;
  sizeOrder: number;
}

type KeyedLine = PackingListLine & SortKeys;

export function toPackingList(order: PackingOrderDetail): PackingList {
  const boxes = order.boxes
    .filter((box) => box.lines.length > 0)
    .map((box) => {
      const lines = sortLines(box.lines.map(toLine));
      return { number: box.number, lines: lines.map(stripKeys), pieces: sum(lines) };
    });

  const summary = sortLines(mergeLines(order.boxes.flatMap((box) => box.lines.map(toLine))));

  return {
    code: order.code,
    name: order.name,
    client: order.client?.name ?? NO_CLIENT_LABEL,
    date: order.date,
    status: order.status,
    preliminary: order.status === "OPEN",
    boxes,
    summary: summary.map(stripKeys),
    totalBoxes: boxes.length,
    totalPieces: sum(summary),
  };
}

/** "packing-EMB-2026-0001-TAMSA-13-11-2026" sin nada que un sistema de archivos rechace. */
export function packingListFileName(list: PackingList): string {
  return `packing-${list.code}-${list.name}`.replace(/[^A-Za-z0-9-]+/g, "-").replace(/-+/g, "-");
}

function toLine(line: PackingBoxLineRow): KeyedLine {
  const category = line.stock.product.garmentCategory;
  return {
    category: category?.name ?? NO_CATEGORY_LABEL,
    product: line.stock.product.name,
    size: line.stock.size.code,
    po: line.stock.clientPo ?? NO_PO_LABEL,
    pieces: line.quantity,
    categoryPosition: category?.position ?? Number.MAX_SAFE_INTEGER,
    sizeOrder: line.stock.size.order,
  };
}

/** Junta los renglones iguales de todas las cajas para el resumen. */
function mergeLines(lines: KeyedLine[]): KeyedLine[] {
  const merged = new Map<string, KeyedLine>();
  for (const line of lines) {
    const key = [line.category, line.product, line.size, line.po].join("|");
    const known = merged.get(key);
    if (known) known.pieces += line.pieces;
    else merged.set(key, { ...line });
  }
  return [...merged.values()];
}

/** Tipo (como en el catálogo), producto, talla (CH antes que XG) y PO. */
function sortLines(lines: KeyedLine[]): KeyedLine[] {
  return [...lines].sort(
    (a, b) =>
      a.categoryPosition - b.categoryPosition ||
      a.product.localeCompare(b.product) ||
      a.sizeOrder - b.sizeOrder ||
      a.po.localeCompare(b.po),
  );
}

/** Las llaves de orden no viajan al papel. */
function stripKeys(line: KeyedLine): PackingListLine {
  return { category: line.category, product: line.product, size: line.size, po: line.po, pieces: line.pieces };
}

function sum(lines: { pieces: number }[]): number {
  return lines.reduce((total, line) => total + line.pieces, 0);
}
