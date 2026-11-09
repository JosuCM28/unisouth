import { fromDateInputValue, todayInputValue } from "@/lib/utils";

/**
 * Qué periodo está mirando el reporte de corte.
 *
 * Todo se maneja como DÍA CALENDARIO en texto ("2026-10-31") y no como
 * instante. El reporte agrupa por día de la fábrica, y comparar cadenas evita
 * que un corte de las 19:00 de Veracruz —que en UTC ya es mañana— se cuente en
 * el día o en el mes equivocado. Sólo al consultar la base se traduce a
 * instantes, en la zona de la fábrica.
 */

/** Cuántos meses hacia atrás se ofrecen. Para algo más viejo está el rango libre. */
const MONTHS_OFFERED = 24;

const LOCALE = "es-MX";

export interface ReportPeriodParams {
  mes?: string;
  desde?: string;
  hasta?: string;
}

export interface ReportPeriod {
  kind: "month" | "range";
  /** "2026-10" cuando es un mes; `null` con rango libre. */
  month: string | null;
  fromKey: string;
  toKey: string;
  previousFromKey: string;
  previousToKey: string;
  label: string;
  previousLabel: string;
  /** Lo que viaja en la URL: la misma ventana en pantalla, Excel y PDF. */
  query: string;
}

export interface ReportMonthOption {
  value: string;
  label: string;
}

/**
 * El rango libre gana sobre el mes: quien tecleó dos fechas hizo una pregunta
 * más precisa que la que trae el selector de mes.
 */
export function resolveReportPeriod(
  params: ReportPeriodParams,
  today: string = todayInputValue(),
): ReportPeriod {
  return (
    readRange(params, today) ?? monthPeriod(readMonth(params.mes, today), today)
  );
}

/**
 * Dos fechas sueltas. Si vienen al revés se voltean, en vez de devolver un
 * reporte en cero que haría creer que no se cortó nada; y el futuro se recorta
 * a hoy porque dividir entre días que no han pasado baja los promedios.
 */
function readRange(
  params: ReportPeriodParams,
  today: string,
): ReportPeriod | null {
  const { desde, hasta } = params;
  if (!isDayKey(desde) || !isDayKey(hasta)) return null;

  const [start, end] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  const fromKey = earliest(start, today);
  const toKey = earliest(end, today);

  // El tramo inmediato anterior, de la misma longitud: comparar 10 días
  // contra 30 daría una caída que no existe.
  const length = daysBetween(fromKey, toKey) + 1;

  return buildPeriod({
    kind: "range",
    month: null,
    fromKey,
    toKey,
    previousFromKey: addDays(fromKey, -length),
    previousToKey: addDays(fromKey, -1),
    query: `desde=${fromKey}&hasta=${toKey}`,
  });
}

/**
 * Un mes contra el anterior.
 *
 * Con el mes en curso se compara contra LOS MISMOS DÍAS del mes pasado. El 9
 * de noviembre, contra octubre completo, cualquier fábrica parecería haberse
 * desplomado un 70%, y ese número es justo el que iría a dar a la junta.
 */
function monthPeriod(month: string, today: string): ReportPeriod {
  const lastDay = lastDayOfMonth(month);
  const fromKey = `${month}-01`;
  const toKey = earliest(lastDay, today);

  const previousMonth = addMonths(month, -1);
  const previousFromKey = `${previousMonth}-01`;
  const previousLast = lastDayOfMonth(previousMonth);
  const sameDays = addDays(previousFromKey, daysBetween(fromKey, toKey));

  return buildPeriod({
    kind: "month",
    month,
    fromKey,
    toKey,
    previousFromKey,
    previousToKey:
      toKey === lastDay ? previousLast : earliest(sameDays, previousLast),
    query: `mes=${month}`,
  });
}

function buildPeriod(
  period: Omit<ReportPeriod, "label" | "previousLabel">,
): ReportPeriod {
  return {
    ...period,
    label: periodLabel(period.month, period.fromKey, period.toKey),
    previousLabel: rangeLabel(period.previousFromKey, period.previousToKey),
  };
}

function periodLabel(month: string | null, from: string, to: string): string {
  if (month) return monthLabel(month);
  return rangeLabel(from, to);
}

function rangeLabel(from: string, to: string): string {
  return `${formatDayKey(from)} – ${formatDayKey(to)}`;
}

/** Un mes de la URL sólo vale si es uno de los que se ofrecen. */
function readMonth(value: string | undefined, today: string): string {
  const current = today.slice(0, 7);
  const allowed = listReportMonths(today).some((m) => m.value === value);
  return allowed && value ? value : current;
}

/** Del mes actual hacia atrás: lo reciente es lo que se pregunta. */
export function listReportMonths(
  today: string = todayInputValue(),
): ReportMonthOption[] {
  const current = today.slice(0, 7);

  return Array.from({ length: MONTHS_OFFERED }, (_, index) => {
    const value = addMonths(current, -index);
    return { value, label: monthLabel(value) };
  });
}

function isDayKey(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // "2026-02-31" pasa la expresión; al volver de Date sale otro día.
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function earliest(a: string, b: string): string {
  return a <= b ? a : b;
}

function keyToDate(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

export function addDays(key: string, days: number): string {
  const date = keyToDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonths(month: string, months: number): string {
  const [year = 0, number = 1] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + months, 15));
  return date.toISOString().slice(0, 7);
}

export function lastDayOfMonth(month: string): string {
  return addDays(`${addMonths(month, 1)}-01`, -1);
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (keyToDate(to).getTime() - keyToDate(from).getTime()) / 86_400_000,
  );
}

/** El arranque de un día de la fábrica, como instante para consultar. */
export function dayStart(key: string): Date {
  return requireInstant(fromDateInputValue(key, "start"), key);
}

/** El final de un día de la fábrica, como instante para consultar. */
export function dayEnd(key: string): Date {
  return requireInstant(fromDateInputValue(key, "end"), key);
}

function requireInstant(value: Date | undefined, key: string): Date {
  if (!value) throw new Error(`Día inválido en el reporte: ${key}`);
  return value;
}

/** El lunes de la semana de ese día: la semana de la fábrica arranca en lunes. */
export function startOfWeek(key: string): string {
  // getUTCDay da 0 en domingo: ese día pertenece a la semana que ya corría.
  const weekday = keyToDate(key).getUTCDay();
  return addDays(key, -((weekday + 6) % 7));
}

export type CutDetailGroup = "day" | "week" | "month";

/**
 * En la URL van en español, como el resto de los parámetros del reporte.
 *
 * Un Map y no un objeto: el valor lo teclea cualquiera, y en un objeto
 * `?agrupar=constructor` encuentra la función heredada y tumba la página.
 */
const GROUP_BY_PARAM = new Map<string, CutDetailGroup>([
  ["dia", "day"],
  ["semana", "week"],
  ["mes", "month"],
]);

export const CUT_DETAIL_GROUP_PARAMS: Record<CutDetailGroup, string> = {
  day: "dia",
  week: "semana",
  month: "mes",
};

/** Lo que no se reconozca cae en "por día", que es la pregunta de todos los días. */
export function parseCutDetailGroup(value: string | undefined): CutDetailGroup {
  return GROUP_BY_PARAM.get(value ?? "") ?? "day";
}

/** "09 nov 2026". En UTC porque la cadena ya ES el día de la fábrica. */
export function formatDayKey(key: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(keyToDate(key));
}

/** "lun 09": el renglón de un día dentro de una ventana de dos semanas. */
export function formatWeekdayKey(key: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(keyToDate(key));
}

/** "lun": debajo de la barra no cabe más. */
export function weekdayShort(key: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(keyToDate(key))
    .replace(".", "");
}

/** "noviembre 2026" */
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(keyToDate(`${month}-15`))
    .replace(" de ", " ");
}

/** "nov 26" */
export function monthShortLabel(month: string): string {
  const name = new Intl.DateTimeFormat(LOCALE, {
    month: "short",
    timeZone: "UTC",
  })
    .format(keyToDate(`${month}-15`))
    .replace(".", "");

  return `${name} ${month.slice(2, 4)}`;
}
