import { fromDateInputValue, toDateInputValue, todayInputValue } from "@/lib/utils";

/**
 * Cómo se corta el tiempo en el reporte de recepciones.
 *
 * Vive en un archivo SIN "use client", igual que `report-ranges.ts` y
 * `history-ranges.ts`: si el array se declarara dentro del componente de
 * filtros —que sí es cliente—, la página lo recibiría como referencia de
 * módulo y reventaría en runtime con un `.map is not a function` que el
 * compilador no detecta.
 *
 * Tres cortes y no más: la pregunta real es "cuánta tela llegó este mes
 * contra el pasado". Por día daría 365 renglones que nadie lee, y por
 * trimestre no lo pidió nadie.
 */
export const PERIOD_GROUPS = [
  { key: "mes", label: "Mes" },
  { key: "semana", label: "Semana" },
  { key: "anio", label: "Año" },
] as const;

export type PeriodGroup = (typeof PERIOD_GROUPS)[number]["key"];

export const DEFAULT_PERIOD_GROUP: PeriodGroup = "mes";

/** Ventana por omisión: el año corrido, contando el mes actual. */
const DEFAULT_RANGE_MONTHS = 12;

/**
 * Tope de renglones de periodo que se rellenan con ceros.
 *
 * Sembrar los huecos es lo correcto —un mes sin recepciones tiene que verse
 * como cero y no desaparecer, o la gráfica miente sobre el ritmo de llegada—,
 * pero cinco años agrupados por semana son 260 renglones que ni se leen ni
 * caben en un celular. Pasado el tope se muestran sólo los periodos con datos.
 */
const MAX_SEEDED_PERIODS = 120;

const MONTH_LABELS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function isPeriodGroup(value: unknown): value is PeriodGroup {
  return PERIOD_GROUPS.some((group) => group.key === value);
}

export function parsePeriodGroup(value: string | null | undefined): PeriodGroup {
  return isPeriodGroup(value) ? value : DEFAULT_PERIOD_GROUP;
}

export interface ReportRange {
  /** Inicio del primer día del rango, en hora de la fábrica. */
  from: Date;
  /** Fin del último día: incluye lo que llegó a las 5 de la tarde. */
  to: Date;
  /** Los mismos límites como los quiere un `<input type="date">`. */
  fromInput: string;
  toInput: string;
}

/**
 * El rango del reporte a partir de lo que traiga la URL.
 *
 * Los dos valores vienen de un input de fecha y el usuario puede teclear
 * cualquier cosa —o invertirlos—, así que se validan y, si vienen al revés,
 * se voltean en vez de devolver un reporte vacío que parecería decir "no
 * llegó nada" cuando lo que pasó es que se escribió mal el rango.
 */
export function parseReportRange(
  desde: string | null | undefined,
  hasta: string | null | undefined,
): ReportRange {
  const today = todayInputValue();

  let fromInput = normalizeDateInput(desde) ?? defaultFromInput(today);
  let toInput = normalizeDateInput(hasta) ?? today;

  if (fromInput > toInput) [fromInput, toInput] = [toInput, fromInput];

  return {
    fromInput,
    toInput,
    // `!` seguro: `normalizeDateInput` ya garantizó el formato YYYY-MM-DD.
    from: fromDateInputValue(fromInput, "start")!,
    to: fromDateInputValue(toInput, "end")!,
  };
}

function normalizeDateInput(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  // Que tenga forma de fecha no la hace válida: "2026-02-31" pasa el regex.
  return fromDateInputValue(value) ? value : null;
}

/** El primer día del mes de hace 11 meses: doce meses contando el actual. */
function defaultFromInput(today: string): string {
  const [year, month] = isoParts(today);
  // Aritmética de calendario pura sobre UTC: sólo se leen año y mes, así que
  // la zona no entra en juego y `Date` normaliza solo el cambio de año.
  const start = new Date(Date.UTC(year, month - 1 - (DEFAULT_RANGE_MONTHS - 1), 1));

  return `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`;
}

/**
 * La clave del periodo al que cae una fecha.
 *
 * Se lee el día EN LA FÁBRICA y no en UTC: una recepción capturada a las 6 de
 * la tarde del 31 de agosto cae en septiembre si se pregunta en UTC, y el mes
 * de agosto saldría corto en el reporte.
 */
export function periodKey(date: Date, group: PeriodGroup): string {
  const iso = toDateInputValue(date);

  if (group === "anio") return iso.slice(0, 4);
  if (group === "mes") return iso.slice(0, 7);
  return mondayOf(iso);
}

export function periodLabel(key: string, group: PeriodGroup): string {
  if (group === "anio") return key;

  if (group === "mes") {
    const [year, month] = isoParts(key);
    return `${MONTH_LABELS[month - 1]} ${year}`;
  }

  const monday = parseIso(key);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  return `${dayMonth(monday)}–${dayMonth(sunday)}`;
}

/** El año de la semana, que no cabe en su etiqueta sin volverla ilegible. */
export function periodHint(key: string, group: PeriodGroup): string {
  return group === "semana" ? key.slice(0, 4) : "";
}

/**
 * Todos los periodos del rango, del más viejo al más nuevo, incluidos los
 * vacíos. Devuelve una lista vacía si serían demasiados para leerse.
 */
export function periodSequence(
  from: Date,
  to: Date,
  group: PeriodGroup,
): string[] {
  const last = periodKey(to, group);
  const keys: string[] = [];

  let cursor = periodKey(from, group);

  while (cursor <= last && keys.length <= MAX_SEEDED_PERIODS) {
    keys.push(cursor);
    cursor = nextPeriod(cursor, group);
  }

  return keys.length > MAX_SEEDED_PERIODS ? [] : keys;
}

function nextPeriod(key: string, group: PeriodGroup): string {
  if (group === "anio") return String(Number(key) + 1);

  if (group === "mes") {
    const [year, month] = isoParts(key);
    const next = new Date(Date.UTC(year, month, 1));
    return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`;
  }

  const monday = parseIso(key);
  monday.setUTCDate(monday.getUTCDate() + 7);
  return isoOf(monday);
}

/** El lunes de la semana a la que pertenece un "YYYY-MM-DD". */
function mondayOf(iso: string): string {
  const date = parseIso(iso);
  // getUTCDay() pone el domingo en 0; la semana de la fábrica empieza en
  // lunes, así que se rota para que el lunes sea el cero.
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);

  return isoOf(date);
}

/**
 * Un "YYYY-MM-DD" como fecha de calendario en UTC.
 *
 * A propósito en UTC: aquí ya no hay instante que ubicar, sólo aritmética de
 * días. Usar hora local haría que un cambio de huso corriera las semanas.
 */
function parseIso(iso: string): Date {
  const [year, month, day] = isoParts(iso);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Los tres números de un "YYYY-MM" o "YYYY-MM-DD".
 *
 * Los valores por omisión no son defensa contra basura —el formato ya viene
 * validado antes de llegar aquí— sino contra `noUncheckedIndexedAccess`, que
 * tipa cada posición del `split` como posiblemente indefinida.
 */
function isoParts(iso: string): [number, number, number] {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);
  return [year, month, day];
}

function isoOf(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function dayMonth(date: Date): string {
  return `${pad(date.getUTCDate())} ${MONTH_LABELS[date.getUTCMonth()]}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
