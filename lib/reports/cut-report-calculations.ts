import { remnantLevel, type RemnantLevel } from "@/lib/export/cut-report";
import {
  addDays,
  addMonths,
  lastDayOfMonth,
  monthShortLabel,
  type ReportPeriod,
} from "@/lib/report-period";
import { cutTotals } from "@/lib/utils";

/**
 * Las cuentas del reporte de corte para dirección.
 *
 * Funciones puras a propósito: reciben hechos ya en números planos y no saben
 * de Prisma. Estas cifras se discuten en junta, y así se pueden revisar —y
 * probar— sin una base de datos enfrente.
 *
 * Todos los bloques salen de la MISMA lista de hechos, así que el total del
 * periodo, la gráfica y el desglose por empresa no pueden contradecirse.
 */

const DAILY_WINDOW = 14;
const MONTHLY_WINDOW = 6;
const TOP_LIMIT = 10;
const NO_CLIENT_LABEL = "Fábrica";
const NO_DESCRIPTION_LABEL = "Sin descripción";

export interface CutBatchFact {
  batchId: string;
  dayKey: string;
  pieces: number;
}

export interface CutOrderFact {
  id: string;
  code: string;
  description: string | null;
  clientId: string | null;
  clientName: string | null;
  ordered: number;
  metersDelivered: number | null;
  metersSpread: number | null;
  smallRemnant: number | null;
  batches: CutBatchFact[];
}

export interface OpenOrderFact {
  dueKey: string | null;
  lines: Array<{ orderedQuantity: number; cutQuantity: number }>;
}

export interface CutSummary {
  pieces: number;
  piecesChange: number | null;
  orderedPieces: number;
  cutPieces: number;
  progress: number | null;
  orders: number;
  ordersChange: number | null;
  cuts: number;
  workedDays: number;
  piecesPerDay: number | null;
  piecesPerDayChange: number | null;
  metersChange: number | null;
  bestDay: { key: string; pieces: number } | null;
}

export interface DailyCutRow {
  key: string;
  pieces: number;
  /** Contra el último día con corte. `null` si hoy no hubo o no hay con qué. */
  difference: number | null;
}

export interface DailyCutSeries {
  days: DailyCutRow[];
  fromKey: string;
  toKey: string;
  total: number;
  previousTotal: number;
  change: number | null;
}

export interface ClientCutRow {
  key: string;
  name: string;
  pieces: number;
  share: number | null;
  orders: number;
  ordered: number;
  cut: number;
  progress: number | null;
}

export interface MonthlyCutRow {
  key: string;
  label: string;
  pieces: number;
  meters: number;
  change: number | null;
  /** El mes no está completo en el reporte: su barra no se compara parejo. */
  partial: boolean;
}

export interface CutYield {
  closedOrders: number;
  measuredOrders: number;
  metersDelivered: number;
  metersSpread: number;
  smallRemnant: number;
  remnantRate: number | null;
  remnantLevel: RemnantLevel | null;
  metersPerPiece: number | null;
  leftover: number | null;
}

export interface TopOrderRow {
  id: string;
  code: string;
  clientName: string;
  description: string;
  pieces: number;
}

export interface TopGarmentRow {
  label: string;
  pieces: number;
  orders: number;
}

export interface CutPending {
  openOrders: number;
  pendingPieces: number;
  overdueOrders: number;
  overduePieces: number;
}

export interface CutReportData {
  period: ReportPeriod;
  summary: CutSummary;
  daily: DailyCutSeries;
  clients: ClientCutRow[];
  monthly: MonthlyCutRow[];
  yieldData: CutYield;
  topOrders: TopOrderRow[];
  topGarments: TopGarmentRow[];
  pending: CutPending;
}

/**
 * El día más viejo que hace falta consultar.
 *
 * La ventana de 14 días pide otros 14 detrás para compararse, y uno de esos
 * días tiene que poder ser "el anterior con corte" del primero de la gráfica.
 */
export function earliestKeyNeeded(period: ReportPeriod): string {
  const dailyStart = addDays(period.toKey, -(DAILY_WINDOW * 3 - 1));
  const monthlyStart = `${addMonths(period.toKey.slice(0, 7), -MONTHLY_WINDOW)}-01`;

  return [period.previousFromKey, dailyStart, monthlyStart].sort()[0] ?? dailyStart;
}

export function buildCutReport(
  facts: CutOrderFact[],
  open: OpenOrderFact[],
  period: ReportPeriod,
  today: string,
): CutReportData {
  return {
    period,
    summary: buildSummary(facts, period),
    daily: buildDaily(facts, period.toKey),
    clients: buildClients(facts, period),
    monthly: buildMonthly(facts, period.toKey, today),
    yieldData: buildYield(facts, period.fromKey, period.toKey),
    topOrders: buildTopOrders(facts, period),
    topGarments: buildTopGarments(facts, period),
    pending: buildPending(open, today),
  };
}

function isBetween(key: string, from: string, to: string): boolean {
  return key >= from && key <= to;
}

function batchesBetween(
  fact: CutOrderFact,
  from: string,
  to: string,
): CutBatchFact[] {
  return fact.batches.filter((batch) => isBetween(batch.dayKey, from, to));
}

function sumPieces(batches: CutBatchFact[]): number {
  return batches.reduce((total, batch) => total + batch.pieces, 0);
}

/** División que se rinde: "no hay con qué comparar" no es lo mismo que cero. */
function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function changeRate(current: number, previous: number): number | null {
  return ratio(current - previous, previous);
}

function piecesByDay(
  facts: CutOrderFact[],
  from: string,
  to: string,
): Map<string, number> {
  const days = new Map<string, number>();

  for (const fact of facts) {
    for (const batch of batchesBetween(fact, from, to)) {
      days.set(batch.dayKey, (days.get(batch.dayKey) ?? 0) + batch.pieces);
    }
  }

  return days;
}

/** Lo cortado hasta el cierre del periodo. */
function cutUntil(fact: CutOrderFact, toKey: string): number {
  /* Hasta `toKey` y no el acumulado de hoy: si no, el avance de octubre
     cambiaría cada vez que se corta en noviembre y un reporte ya entregado
     dejaría de cuadrar con el mismo reporte sacado después. */
  return fact.batches
    .filter((batch) => batch.dayKey <= toKey)
    .reduce((total, batch) => total + batch.pieces, 0);
}

function lastCutKey(fact: CutOrderFact): string | null {
  return fact.batches.map((batch) => batch.dayKey).sort().at(-1) ?? null;
}

interface RangeTotals {
  pieces: number;
  orders: number;
  cuts: number;
  workedDays: number;
  piecesPerDay: number | null;
  days: Map<string, number>;
}

function rangeTotals(
  facts: CutOrderFact[],
  from: string,
  to: string,
): RangeTotals {
  const inRange = facts.map((fact) => batchesBetween(fact, from, to));
  const days = piecesByDay(facts, from, to);
  const pieces = sumPieces(inRange.flat());
  // Sólo los días con corte: dividir entre domingos castigaría el promedio.
  const workedDays = [...days.values()].filter((value) => value > 0).length;

  return {
    pieces,
    orders: inRange.filter((batches) => batches.length > 0).length,
    // Por corte y no por hecho: uno con bultos de dos días sigue siendo uno.
    cuts: new Set(inRange.flat().map((batch) => batch.batchId)).size,
    workedDays,
    piecesPerDay: ratio(pieces, workedDays),
    days,
  };
}

function bestDay(days: Map<string, number>): CutSummary["bestDay"] {
  let best: CutSummary["bestDay"] = null;

  for (const [key, pieces] of days) {
    if (pieces > 0 && (!best || pieces > best.pieces)) best = { key, pieces };
  }

  return best;
}

function buildSummary(facts: CutOrderFact[], period: ReportPeriod): CutSummary {
  const current = rangeTotals(facts, period.fromKey, period.toKey);
  const previous = rangeTotals(
    facts,
    period.previousFromKey,
    period.previousToKey,
  );

  const worked = facts.filter(
    (fact) => batchesBetween(fact, period.fromKey, period.toKey).length > 0,
  );
  const orderedPieces = worked.reduce((total, fact) => total + fact.ordered, 0);
  const cutPieces = worked.reduce(
    (total, fact) => total + cutUntil(fact, period.toKey),
    0,
  );

  return {
    pieces: current.pieces,
    piecesChange: changeRate(current.pieces, previous.pieces),
    orderedPieces,
    cutPieces,
    progress: ratio(cutPieces, orderedPieces),
    orders: current.orders,
    ordersChange: changeRate(current.orders, previous.orders),
    cuts: current.cuts,
    workedDays: current.workedDays,
    piecesPerDay: current.piecesPerDay,
    piecesPerDayChange: changeRate(
      current.piecesPerDay ?? 0,
      previous.piecesPerDay ?? 0,
    ),
    metersChange: changeRate(
      metersSpreadBetween(facts, period.fromKey, period.toKey),
      metersSpreadBetween(facts, period.previousFromKey, period.previousToKey),
    ),
    bestDay: bestDay(current.days),
  };
}

/**
 * Las órdenes cuyo ÚLTIMO corte cae en el tramo.
 *
 * Los metros se capturan una sola vez por orden, al levantar la mesa, y no por
 * corte. Atribuirlos al último corte hace que cada orden cuente exactamente
 * una vez; repartirlos entre sus cortes exigiría inventar un criterio.
 */
function closedBetween(
  facts: CutOrderFact[],
  from: string,
  to: string,
): CutOrderFact[] {
  return facts.filter((fact) => {
    const last = lastCutKey(fact);
    return last !== null && isBetween(last, from, to);
  });
}

function metersSpreadBetween(
  facts: CutOrderFact[],
  from: string,
  to: string,
): number {
  return closedBetween(facts, from, to).reduce(
    (total, fact) => total + (fact.metersSpread ?? 0),
    0,
  );
}

function buildDaily(facts: CutOrderFact[], toKey: string): DailyCutSeries {
  const fromKey = addDays(toKey, -(DAILY_WINDOW - 1));
  const previousFrom = addDays(fromKey, -DAILY_WINDOW);
  const previousTo = addDays(fromKey, -1);

  const all = piecesByDay(facts, addDays(fromKey, -DAILY_WINDOW * 2), toKey);
  const workedKeys = [...all.entries()]
    .filter(([, pieces]) => pieces > 0)
    .map(([key]) => key)
    .sort();

  const days = Array.from({ length: DAILY_WINDOW }, (_, index) => {
    const key = addDays(fromKey, index);
    const pieces = all.get(key) ?? 0;
    return { key, pieces, difference: dayDifference(key, pieces, workedKeys, all) };
  });

  const total = days.reduce((sum, day) => sum + day.pieces, 0);
  const previousTotal = rangeTotals(facts, previousFrom, previousTo).pieces;

  return {
    days,
    fromKey,
    toKey,
    total,
    previousTotal,
    change: changeRate(total, previousTotal),
  };
}

/**
 * La diferencia contra el último día QUE HUBO CORTE, no contra el de ayer.
 *
 * Contra el calendario, cada domingo saldría "−900" y cada lunes "+900": dos
 * cifras enormes que no dicen nada del ritmo de la mesa y taparían las que sí.
 */
function dayDifference(
  key: string,
  pieces: number,
  workedKeys: string[],
  all: Map<string, number>,
): number | null {
  if (pieces <= 0) return null;

  const previousKey = workedKeys.filter((worked) => worked < key).at(-1);
  if (!previousKey) return null;

  return pieces - (all.get(previousKey) ?? 0);
}

function clientKey(fact: CutOrderFact): string {
  return fact.clientId ?? "__factory__";
}

function buildClients(
  facts: CutOrderFact[],
  period: ReportPeriod,
): ClientCutRow[] {
  const rows = new Map<string, ClientCutRow>();
  let total = 0;

  for (const fact of facts) {
    const batches = batchesBetween(fact, period.fromKey, period.toKey);
    if (batches.length === 0) continue;

    const key = clientKey(fact);
    const row = rows.get(key) ?? emptyClientRow(key, fact);
    const pieces = sumPieces(batches);

    total += pieces;
    row.pieces += pieces;
    row.orders += 1;
    row.ordered += fact.ordered;
    row.cut += cutUntil(fact, period.toKey);
    rows.set(key, row);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      share: ratio(row.pieces, total),
      progress: ratio(row.cut, row.ordered),
    }))
    .sort((a, b) => b.pieces - a.pieces);
}

function emptyClientRow(key: string, fact: CutOrderFact): ClientCutRow {
  return {
    key,
    name: fact.clientName ?? NO_CLIENT_LABEL,
    pieces: 0,
    share: null,
    orders: 0,
    ordered: 0,
    cut: 0,
    progress: null,
  };
}

function buildMonthly(
  facts: CutOrderFact[],
  toKey: string,
  today: string,
): MonthlyCutRow[] {
  const toMonth = toKey.slice(0, 7);
  const keys = Array.from({ length: MONTHLY_WINDOW + 1 }, (_, index) =>
    addMonths(toMonth, index - MONTHLY_WINDOW),
  );

  const raw = keys.map((key) => monthTotals(facts, key, toKey));

  // Se calcula un mes de más sólo para que el primero tenga contra qué medirse.
  return raw.slice(1).map((row, index) => {
    const previous = raw[index];
    const partial = isPartialMonth(row.key, toKey, today);

    return {
      ...row,
      label: monthShortLabel(row.key),
      /* Un mes a medias contra uno completo siempre sale en picada. Esa cifra
         no significa nada y es la primera que se lee, así que no se da. */
      change: partial ? null : changeRate(row.pieces, previous?.pieces ?? 0),
      partial,
    };
  });
}

function monthTotals(facts: CutOrderFact[], key: string, toKey: string) {
  const from = `${key}-01`;
  const last = lastDayOfMonth(key);
  const to = last <= toKey ? last : toKey;

  return {
    key,
    pieces: rangeTotals(facts, from, to).pieces,
    meters: metersSpreadBetween(facts, from, to),
  };
}

function isPartialMonth(key: string, toKey: string, today: string): boolean {
  const last = lastDayOfMonth(key);
  return last > toKey || last > today;
}

function buildYield(
  facts: CutOrderFact[],
  from: string,
  to: string,
): CutYield {
  const closed = closedBetween(facts, from, to);
  const measured = closed.filter((fact) => fact.metersSpread !== null);
  const spreadOf = (fact: CutOrderFact) => fact.metersSpread ?? 0;

  /* Cada razón divide SÓLO entre las órdenes que traen sus dos datos. Una
     orden con metros y sin retacería anotada, metida en el denominador, haría
     ver un porcentaje de retacería mejor del que fue. */
  const withRemnant = measured.filter((fact) => fact.smallRemnant !== null);
  const withPieces = measured.filter((fact) => cutUntil(fact, to) > 0);
  const withDelivered = measured.filter((fact) => fact.metersDelivered !== null);

  const smallRemnant = sumBy(withRemnant, (fact) => fact.smallRemnant ?? 0);
  const remnantRate = ratio(smallRemnant, sumBy(withRemnant, spreadOf));
  const delivered = sumBy(withDelivered, (fact) => fact.metersDelivered ?? 0);

  return {
    closedOrders: closed.length,
    measuredOrders: measured.length,
    metersDelivered: delivered,
    metersSpread: sumBy(measured, spreadOf),
    smallRemnant,
    remnantRate,
    remnantLevel: remnantLevel(remnantRate),
    metersPerPiece: ratio(
      sumBy(withPieces, spreadOf),
      sumBy(withPieces, (fact) => cutUntil(fact, to)),
    ),
    leftover:
      withDelivered.length > 0
        ? delivered - sumBy(withDelivered, spreadOf)
        : null,
  };
}

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

function buildTopOrders(
  facts: CutOrderFact[],
  period: ReportPeriod,
): TopOrderRow[] {
  return facts
    .map((fact) => ({
      id: fact.id,
      code: fact.code,
      clientName: fact.clientName ?? NO_CLIENT_LABEL,
      description: fact.description ?? NO_DESCRIPTION_LABEL,
      pieces: sumPieces(batchesBetween(fact, period.fromKey, period.toKey)),
    }))
    .filter((row) => row.pieces > 0)
    .sort((a, b) => b.pieces - a.pieces)
    .slice(0, TOP_LIMIT);
}

function buildTopGarments(
  facts: CutOrderFact[],
  period: ReportPeriod,
): TopGarmentRow[] {
  const rows = new Map<string, TopGarmentRow>();

  for (const fact of facts) {
    const pieces = sumPieces(batchesBetween(fact, period.fromKey, period.toKey));
    if (pieces <= 0) continue;

    // La descripción es texto libre: "Overol" y "OVEROL " son la misma prenda.
    const label = fact.description?.trim() || NO_DESCRIPTION_LABEL;
    const key = label.toUpperCase();
    const row = rows.get(key) ?? { label, pieces: 0, orders: 0 };

    row.pieces += pieces;
    row.orders += 1;
    rows.set(key, row);
  }

  return [...rows.values()]
    .sort((a, b) => b.pieces - a.pieces)
    .slice(0, TOP_LIMIT);
}

function buildPending(open: OpenOrderFact[], today: string): CutPending {
  const result: CutPending = {
    openOrders: open.length,
    pendingPieces: 0,
    overdueOrders: 0,
    overduePieces: 0,
  };

  for (const order of open) {
    // Talla por talla: un excedente en una no tapa lo que falta en otra.
    const { pending } = cutTotals(order.lines);
    result.pendingPieces += pending;

    if (pending > 0 && order.dueKey !== null && order.dueKey < today) {
      result.overdueOrders += 1;
      result.overduePieces += pending;
    }
  }

  return result;
}
