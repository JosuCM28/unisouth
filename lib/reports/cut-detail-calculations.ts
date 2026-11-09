import {
  addDays,
  addMonths,
  formatDayKey,
  lastDayOfMonth,
  monthLabel,
  startOfWeek,
  weekdayShort,
  type CutDetailGroup,
  type ReportPeriod,
} from "@/lib/report-period";

/**
 * Las cuentas del detalle de corte: qué se cortó, agrupado por día, semana o
 * mes. Funciones puras, igual que las del reporte general.
 */

const NO_CLIENT_LABEL = "Fábrica";
const NO_DESCRIPTION_LABEL = "Sin descripción";
const NO_CAPTURER_LABEL = "Sin registro";

export interface CutDetailSizeFact {
  code: string;
  pieces: number;
}

export interface CutDetailFact {
  id: string;
  /** Un corte con bultos de dos días son dos hechos con el mismo `batchId`. */
  batchId: string;
  dayKey: string;
  cutNumber: number;
  cutLabel: string | null;
  orderId: string;
  orderCode: string;
  clientName: string | null;
  description: string | null;
  capturedBy: string | null;
  bundles: number;
  /** Ya en el orden de tallas del catálogo. */
  sizes: CutDetailSizeFact[];
}

export interface CutDetailItem {
  id: string;
  batchId: string;
  dayKey: string;
  orderId: string;
  orderCode: string;
  clientName: string;
  description: string;
  cutName: string;
  capturedBy: string;
  bundles: number;
  pieces: number;
  sizes: CutDetailSizeFact[];
}

export interface CutDetailBucket {
  key: string;
  label: string;
  /** El rango lo corta a la mitad: no se compara parejo contra uno completo. */
  partial: boolean;
  pieces: number;
  bundles: number;
  orders: number;
  cuts: number;
  share: number | null;
  /** Contra el anterior con corte. `null` si no hay contra qué, o no es parejo. */
  difference: number | null;
  items: CutDetailItem[];
}

export interface CutDetailTotals {
  pieces: number;
  bundles: number;
  orders: number;
  cuts: number;
  bucketsWithCut: number;
  piecesPerBucket: number | null;
  best: { label: string; pieces: number } | null;
}

export interface CutDetailData {
  period: ReportPeriod;
  group: CutDetailGroup;
  buckets: CutDetailBucket[];
  totals: CutDetailTotals;
}

interface BucketGrouping {
  keyOf: (dayKey: string) => string;
  next: (key: string) => string;
  firstDay: (key: string) => string;
  lastDay: (key: string) => string;
  label: (key: string) => string;
  /**
   * Una semana o un mes en cero SÍ se enseña: es una noticia. Un día en cero
   * casi siempre es domingo, y treinta renglones vacíos taparían el reporte.
   */
  keepEmpty: boolean;
}

const GROUPINGS: Record<CutDetailGroup, BucketGrouping> = {
  day: {
    keyOf: (dayKey) => dayKey,
    next: (key) => addDays(key, 1),
    firstDay: (key) => key,
    lastDay: (key) => key,
    label: (key) => `${weekdayShort(key)} ${formatDayKey(key)}`,
    keepEmpty: false,
  },
  week: {
    keyOf: startOfWeek,
    next: (key) => addDays(key, 7),
    firstDay: (key) => key,
    lastDay: (key) => addDays(key, 6),
    label: (key) => `${formatDayKey(key)} – ${formatDayKey(addDays(key, 6))}`,
    keepEmpty: true,
  },
  month: {
    keyOf: (dayKey) => dayKey.slice(0, 7),
    next: (key) => addMonths(key, 1),
    firstDay: (key) => `${key}-01`,
    lastDay: lastDayOfMonth,
    label: monthLabel,
    keepEmpty: true,
  },
};

export function buildCutDetail(
  facts: CutDetailFact[],
  period: ReportPeriod,
  group: CutDetailGroup,
): CutDetailData {
  const grouping = GROUPINGS[group];
  const itemsByKey = groupItems(facts, grouping);
  const totalPieces = sumPieces(facts.map(toItem));

  const buckets = bucketKeys(grouping, period)
    .map((key) =>
      buildBucket(key, itemsByKey.get(key) ?? [], grouping, period, totalPieces),
    )
    .filter((bucket) => grouping.keepEmpty || bucket.cuts > 0);

  applyDifferences(buckets);

  return { period, group, buckets, totals: buildTotals(facts, buckets) };
}

function bucketKeys(grouping: BucketGrouping, period: ReportPeriod): string[] {
  const keys: string[] = [];
  let key = grouping.keyOf(period.fromKey);

  while (grouping.firstDay(key) <= period.toKey) {
    keys.push(key);
    key = grouping.next(key);
  }

  return keys;
}

function toItem(fact: CutDetailFact): CutDetailItem {
  return {
    id: fact.id,
    batchId: fact.batchId,
    dayKey: fact.dayKey,
    orderId: fact.orderId,
    orderCode: fact.orderCode,
    clientName: fact.clientName ?? NO_CLIENT_LABEL,
    description: fact.description?.trim() || NO_DESCRIPTION_LABEL,
    cutName: fact.cutLabel?.trim() || `Corte ${fact.cutNumber}`,
    capturedBy: fact.capturedBy ?? NO_CAPTURER_LABEL,
    bundles: fact.bundles,
    pieces: fact.sizes.reduce((total, size) => total + size.pieces, 0),
    sizes: fact.sizes,
  };
}

function groupItems(
  facts: CutDetailFact[],
  grouping: BucketGrouping,
): Map<string, CutDetailItem[]> {
  const groups = new Map<string, CutDetailItem[]>();

  for (const fact of facts) {
    const key = grouping.keyOf(fact.dayKey);
    groups.set(key, [...(groups.get(key) ?? []), toItem(fact)]);
  }

  return groups;
}

function sumPieces(items: CutDetailItem[]): number {
  return items.reduce((total, item) => total + item.pieces, 0);
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function buildBucket(
  key: string,
  items: CutDetailItem[],
  grouping: BucketGrouping,
  period: ReportPeriod,
  totalPieces: number,
): CutDetailBucket {
  const pieces = sumPieces(items);

  return {
    key,
    label: grouping.label(key),
    partial:
      grouping.firstDay(key) < period.fromKey ||
      grouping.lastDay(key) > period.toKey,
    pieces,
    bundles: items.reduce((total, item) => total + item.bundles, 0),
    orders: new Set(items.map((item) => item.orderId)).size,
    cuts: new Set(items.map((item) => item.batchId)).size,
    share: ratio(pieces, totalPieces),
    difference: null,
    // De la mañana a la noche: se lee como bitácora de lo que pasó en la mesa.
    items: [...items].sort(compareItems),
  };
}

function compareItems(a: CutDetailItem, b: CutDetailItem): number {
  return (
    a.dayKey.localeCompare(b.dayKey) ||
    a.orderCode.localeCompare(b.orderCode) ||
    a.cutName.localeCompare(b.cutName)
  );
}

/**
 * Contra el anterior QUE TUVO CORTE, como en la gráfica de 14 días.
 *
 * Y sólo entre periodos parejos: una semana de tres días contra una completa
 * siempre sale en picada, y esa cifra no diría nada del ritmo de la mesa.
 */
function applyDifferences(buckets: CutDetailBucket[]): void {
  let previous: CutDetailBucket | null = null;

  for (const bucket of buckets) {
    if (bucket.pieces <= 0) continue;

    if (previous && !previous.partial && !bucket.partial) {
      bucket.difference = bucket.pieces - previous.pieces;
    }

    previous = bucket;
  }
}

function buildTotals(
  facts: CutDetailFact[],
  buckets: CutDetailBucket[],
): CutDetailTotals {
  const worked = buckets.filter((bucket) => bucket.pieces > 0);
  const pieces = buckets.reduce((total, bucket) => total + bucket.pieces, 0);
  const best = [...worked].sort((a, b) => b.pieces - a.pieces)[0];

  return {
    pieces,
    bundles: facts.reduce((total, fact) => total + fact.bundles, 0),
    // Del conjunto y no sumando periodos: una orden cortada en dos semanas
    // sigue siendo una orden.
    orders: new Set(facts.map((fact) => fact.orderId)).size,
    cuts: new Set(facts.map((fact) => fact.batchId)).size,
    bucketsWithCut: worked.length,
    piecesPerBucket: ratio(pieces, worked.length),
    best: best ? { label: best.label, pieces: best.pieces } : null,
  };
}
