import {
  DELIVERY_AGE_ORDER,
  DELIVERY_PROGRESS_ORDER,
  type DeliveryAge,
  type DeliveryProgress,
} from "@/lib/constants/workshop-access";
import { formatWeekdayKey, startOfWeek } from "@/lib/report-period";
import { toDateInputValue } from "@/lib/utils";
import type { ReportDelivery } from "./workshop-report-rows";

/**
 * Los números del reporte del tablero, ya calculados.
 *
 * Aparte del Excel por la misma razón que la hoja del vale: aquí se decide QUÉ
 * se cuenta —qué entra como recibido, desde cuándo corren los días—, y la hoja
 * sólo lo escribe.
 */

export interface PeriodTotals {
  deliveries: number;
  pieces: number;
  bundles: number;
  receivedPieces: number;
  inTransitPieces: number;
  inPlantPieces: number;
  cancelled: number;
  /** Tanto por uno: 0.85 = 85 %. Null sin piezas enviadas. */
  receivedShare: number | null;
  avgDaysToReceive: number | null;
  maxDaysToReceive: number | null;
}

export interface TimelinePoint {
  label: string;
  received: number;
  pending: number;
}

export interface NamedTotal {
  name: string;
  deliveries: number;
  pieces: number;
  receivedPieces: number;
}

export interface WorkshopBoardReport {
  totals: PeriodTotals;
  previous: PeriodTotals;
  /** Día por día si el periodo es corto; por semana si no. */
  timelineUnit: "day" | "week";
  timeline: TimelinePoint[];
  byProgress: { progress: DeliveryProgress; deliveries: number; pieces: number }[];
  byClient: NamedTotal[];
  byGarment: NamedTotal[];
  byStage: NamedTotal[];
  ageing: { age: DeliveryAge; received: number; pending: number }[];
  /** Lo que más lleva esperando, para atenderlo primero. */
  oldestPending: ReportDelivery[];
}

/** Más de un mes de días haría barras de un pelo: se pasa a semanas. */
const MAX_DAILY_POINTS = 31;
/** Cuántos clientes o prendas se grafican; el resto se junta en "Otros". */
const TOP_ITEMS = 10;
const OLDEST_PENDING = 15;

function isLive(delivery: ReportDelivery): boolean {
  return delivery.progress !== "CANCELLED";
}

function sumPieces(rows: ReportDelivery[], progress?: DeliveryProgress): number {
  return rows
    .filter((row) => !progress || row.progress === progress)
    .reduce((sum, row) => sum + row.pieces, 0);
}

export function periodTotals(rows: ReportDelivery[]): PeriodTotals {
  const live = rows.filter(isLive);
  const pieces = sumPieces(live);
  const receivedPieces = sumPieces(live, "RECEIVED");
  const days = live
    .map((row) => row.daysToReceive)
    .filter((value): value is number => value !== null);

  return {
    deliveries: live.length,
    pieces,
    bundles: live.reduce((sum, row) => sum + row.bundles, 0),
    receivedPieces,
    inTransitPieces: sumPieces(live, "IN_TRANSIT"),
    inPlantPieces: sumPieces(live, "IN_PLANT"),
    cancelled: rows.length - live.length,
    receivedShare: pieces > 0 ? receivedPieces / pieces : null,
    avgDaysToReceive:
      days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : null,
    maxDaysToReceive: days.length > 0 ? Math.max(...days) : null,
  };
}

function daysInRange(fromKey: string, toKey: string): number {
  return (Date.parse(toKey) - Date.parse(fromKey)) / 86_400_000 + 1;
}

/**
 * Todos los días (o semanas) del periodo, aunque no se haya mandado nada:
 * un hueco en la gráfica es información —ese día no salió nada al taller—, y
 * saltárselo juntaría dos barras que no son vecinas.
 */
function timelineKeys(fromKey: string, toKey: string, unit: "day" | "week") {
  const keys: string[] = [];
  const step = unit === "day" ? 1 : 7;
  let cursor = unit === "day" ? fromKey : startOfWeek(fromKey);

  while (cursor <= toKey) {
    keys.push(cursor);
    const next = new Date(`${cursor}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + step);
    cursor = next.toISOString().slice(0, 10);
  }
  return keys;
}

/* Cortas a propósito: van debajo de cada barra, y con treinta barras una
   fecha larga se encima con la de al lado. */
function timelineLabel(key: string, unit: "day" | "week"): string {
  if (unit === "day") return formatWeekdayKey(key).replace(".", "");
  return `Sem. ${key.slice(8)}/${key.slice(5, 7)}`;
}

function buildTimeline(
  rows: ReportDelivery[],
  fromKey: string,
  toKey: string,
): { unit: "day" | "week"; points: TimelinePoint[] } {
  const unit = daysInRange(fromKey, toKey) > MAX_DAILY_POINTS ? "week" : "day";
  const keyOf = (date: Date) => {
    const day = toDateInputValue(date);
    return unit === "day" ? day : startOfWeek(day);
  };

  const points = new Map(
    timelineKeys(fromKey, toKey, unit).map((key) => [
      key,
      { label: timelineLabel(key, unit), received: 0, pending: 0 },
    ]),
  );

  for (const row of rows.filter(isLive)) {
    const point = points.get(keyOf(row.sentAt));
    if (!point) continue;
    if (row.progress === "RECEIVED") point.received += row.pieces;
    else point.pending += row.pieces;
  }

  return { unit, points: [...points.values()] };
}

function groupBy(
  rows: ReportDelivery[],
  nameOf: (row: ReportDelivery) => string,
): NamedTotal[] {
  const groups = new Map<string, NamedTotal>();

  for (const row of rows.filter(isLive)) {
    const name = nameOf(row);
    const group = groups.get(name) ?? {
      name,
      deliveries: 0,
      pieces: 0,
      receivedPieces: 0,
    };
    group.deliveries += 1;
    group.pieces += row.pieces;
    if (row.progress === "RECEIVED") group.receivedPieces += row.pieces;
    groups.set(name, group);
  }

  return [...groups.values()].sort((a, b) => b.pieces - a.pieces);
}

/** Los primeros diez y el resto junto: once barras se leen, cuarenta no. */
function topWithOthers(groups: NamedTotal[]): NamedTotal[] {
  if (groups.length <= TOP_ITEMS + 1) return groups;

  const others = groups.slice(TOP_ITEMS).reduce(
    (total, group) => ({
      name: "Otros",
      deliveries: total.deliveries + group.deliveries,
      pieces: total.pieces + group.pieces,
      receivedPieces: total.receivedPieces + group.receivedPieces,
    }),
    { name: "Otros", deliveries: 0, pieces: 0, receivedPieces: 0 },
  );
  return [...groups.slice(0, TOP_ITEMS), others];
}

function ageOf(days: number): DeliveryAge {
  if (days <= 1) return "UP_TO_1";
  if (days <= 3) return "UP_TO_3";
  if (days <= 7) return "UP_TO_7";
  return "OVER_7";
}

/**
 * Qué tan rápido se confirma lo que llega, junto a cuánto lleva esperando lo
 * que falta. Las dos en los mismos tramos para que se lean lado a lado.
 */
function buildAgeing(rows: ReportDelivery[]) {
  return DELIVERY_AGE_ORDER.map((age) => ({
    age,
    received: rows.filter(
      (row) => row.daysToReceive !== null && ageOf(row.daysToReceive) === age,
    ).length,
    pending: rows.filter(
      (row) => row.daysWaiting !== null && ageOf(row.daysWaiting) === age,
    ).length,
  }));
}

export function buildWorkshopBoardReport(input: {
  rows: ReportDelivery[];
  previousRows: ReportDelivery[];
  fromKey: string;
  toKey: string;
}): WorkshopBoardReport {
  const { rows } = input;
  const timeline = buildTimeline(rows, input.fromKey, input.toKey);

  return {
    totals: periodTotals(rows),
    previous: periodTotals(input.previousRows),
    timelineUnit: timeline.unit,
    timeline: timeline.points,
    byProgress: DELIVERY_PROGRESS_ORDER.map((progress) => {
      const matching = rows.filter((row) => row.progress === progress);
      return {
        progress,
        deliveries: matching.length,
        pieces: sumPieces(matching),
      };
    }),
    byClient: topWithOthers(groupBy(rows, (row) => row.clientName)),
    byGarment: topWithOthers(groupBy(rows, (row) => row.description)),
    byStage: groupBy(rows, (row) => row.stageName),
    ageing: buildAgeing(rows),
    oldestPending: rows
      .filter((row) => row.daysWaiting !== null)
      .sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0))
      .slice(0, OLDEST_PENDING),
  };
}
