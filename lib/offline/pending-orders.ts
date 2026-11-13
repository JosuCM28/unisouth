import type { QueuedItem } from "./queue";

/**
 * Lo que una orden tiene capturado en ESTE celular y todavía no sube.
 *
 * Igual que `local-stock.ts`: es un estimado que sólo vive en pantalla. El
 * avance real lo recalcula el servidor al subir el corte. Esto sólo evita que
 * la ficha sin señal diga "0 cortadas" justo después de capturar 40, y que el
 * auxiliar las vuelva a capturar creyendo que no se guardaron.
 */

export interface PendingOrderCaptures {
  /** Las capturas de la orden, en el orden en que se van a subir. */
  items: QueuedItem[];
  /** Piezas cortadas pendientes por renglón de la orden. */
  cutByLine: Map<string, number>;
  /** Piezas enviadas pendientes por "talla:etapa". */
  sentBySizeStage: Map<string, number>;
}

const EMPTY: PendingOrderCaptures = {
  items: [],
  cutByLine: new Map(),
  sentBySizeStage: new Map(),
};

/** Agrupa la cola por orden. Las capturas sin orden no se cuentan. */
export function pendingByOrder(items: QueuedItem[]): Map<string, PendingOrderCaptures> {
  const grouped = new Map<string, PendingOrderCaptures>();

  for (const item of items) {
    if (!item.orderId) continue;

    const entry = grouped.get(item.orderId) ?? {
      items: [],
      cutByLine: new Map<string, number>(),
      sentBySizeStage: new Map<string, number>(),
    };
    entry.items.push(item);
    addCut(entry.cutByLine, item);
    addSent(entry.sentBySizeStage, item);
    grouped.set(item.orderId, entry);
  }

  return grouped;
}

export function pendingOf(
  grouped: Map<string, PendingOrderCaptures>,
  orderId: string,
): PendingOrderCaptures {
  return grouped.get(orderId) ?? EMPTY;
}

export function sizeStageKey(sizeId: string, stageId: string): string {
  return `${sizeId}:${stageId}`;
}

/* ── Lectura de payloads ──────────────────────────────────────────────────
   La cola guarda `unknown` —el mismo payload que recibe la action—, así que
   se lee con cuidado: uno que no tenga la forma esperada no aporta nada en
   vez de reventar la pantalla. */

interface BundleLike {
  quantity?: unknown;
  sentQuantity?: unknown;
  bundles?: unknown;
  lineId?: unknown;
  sizeId?: unknown;
}

function addCut(totals: Map<string, number>, item: QueuedItem): void {
  if (item.kind !== "cut.create") return;

  for (const line of linesOf(item.payload, "batch")) {
    if (typeof line.lineId !== "string") continue;
    const pieces = Number(line.quantity) * bundlesOf(line);
    if (Number.isFinite(pieces)) add(totals, line.lineId, pieces);
  }
}

function addSent(totals: Map<string, number>, item: QueuedItem): void {
  if (item.kind !== "shipment.create") return;

  const stageId = fieldOf(item.payload, "shipment", "stageId");
  if (typeof stageId !== "string") return;

  for (const line of linesOf(item.payload, "shipment")) {
    if (typeof line.sizeId !== "string") continue;
    const pieces = Number(line.sentQuantity) * bundlesOf(line);
    if (Number.isFinite(pieces)) add(totals, sizeStageKey(line.sizeId, stageId), pieces);
  }
}

function add(totals: Map<string, number>, key: string, pieces: number): void {
  totals.set(key, (totals.get(key) ?? 0) + pieces);
}

/** Sin bultos se entiende uno, igual que en el esquema del servidor. */
function bundlesOf(line: BundleLike): number {
  const bundles = Number(line.bundles ?? 1);
  return Number.isFinite(bundles) ? bundles : 1;
}

function fieldOf(payload: unknown, wrapper: string, field: string): unknown {
  if (!payload || typeof payload !== "object" || !(wrapper in payload)) return undefined;

  const inner = (payload as Record<string, unknown>)[wrapper];
  if (!inner || typeof inner !== "object") return undefined;

  return (inner as Record<string, unknown>)[field];
}

function linesOf(payload: unknown, wrapper: string): BundleLike[] {
  const lines = fieldOf(payload, wrapper, "lines");
  return Array.isArray(lines) ? (lines as BundleLike[]) : [];
}
