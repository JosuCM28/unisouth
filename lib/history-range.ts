import { APP_TIMEZONE } from "@/lib/utils";
import {
  DEFAULT_HISTORY_RANGE,
  HISTORY_RANGES,
  isHistoryRange,
  type HistoryRangeKey,
} from "@/lib/constants/history-ranges";

export interface ResolvedRange {
  from: Date;
  to: Date;
  /** Preset activo, o `null` si el usuario puso fecha y hora a mano. */
  preset: HistoryRangeKey | null;
  /** Cómo se describe la ventana en pantalla. */
  label: string;
}

export interface RangeParams {
  rango?: string;
  desde?: string;
  hasta?: string;
}

/**
 * Qué ventana de tiempo se está mirando.
 *
 * El rango a mano GANA sobre el preset: si el auxiliar se tomó la molestia de
 * teclear "hoy de 6 a 8", esa es la pregunta que quiere responder, aunque la
 * pestaña "Mes" siga pintada de antes en la URL.
 */
export function resolveRange(params: RangeParams): ResolvedRange {
  const custom = readCustom(params);
  if (custom) return custom;

  const preset = isHistoryRange(params.rango)
    ? params.rango
    : DEFAULT_HISTORY_RANGE;

  return fromPreset(preset);
}

/**
 * Traduce el preset a un intervalo real.
 *
 * "Hoy" no son "las últimas 24 horas": arranca a medianoche EN LA ZONA DE LA
 * FÁBRICA. Si se calculara con la hora del servidor —que en un VPS suele
 * estar en UTC— a las 20:00 de Veracruz "hoy" ya sería mañana y el turno de
 * la tarde aparecería en el día equivocado.
 */
function fromPreset(preset: HistoryRangeKey): ResolvedRange {
  const option = HISTORY_RANGES.find((range) => range.key === preset)!;
  const now = new Date();

  if (option.days === 0) {
    return {
      from: startOfDayInZone(now),
      to: now,
      preset,
      label: "Hoy",
    };
  }

  const from = new Date(now);
  from.setDate(from.getDate() - option.days);

  return { from, to: now, preset, label: `Últimos ${option.days} días` };
}

/**
 * Lee el rango tecleado a mano, si viene completo y es coherente.
 *
 * Se exigen ambos extremos: con sólo uno no hay ventana, y adivinar el otro
 * daría totales que el usuario no pidió. Si vienen al revés se voltean, en
 * vez de devolver cero movimientos y hacer creer que no hubo nada.
 */
function readCustom(params: RangeParams): ResolvedRange | null {
  const from = parseLocalInput(params.desde);
  const to = parseLocalInput(params.hasta);

  if (!from || !to) return null;

  const [start, end] = from <= to ? [from, to] : [to, from];

  return {
    from: start,
    to: end,
    preset: null,
    label: `${formatStamp(start)} – ${formatStamp(end)}`,
  };
}

/**
 * Convierte lo que escupe un `<input type="datetime-local">` a un instante.
 *
 * El input entrega hora de pared ("2026-08-19T06:00") sin zona. Pasarla a
 * `new Date()` la interpretaría en la zona del SERVIDOR, así que un filtro
 * de 6 a 8 de la mañana en Veracruz traería los movimientos de la 1 a las 3
 * de la madrugada. Aquí se ancla explícitamente a la zona de la fábrica.
 */
function parseLocalInput(value: string | undefined): Date | null {
  if (!value) return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/,
  );
  if (!match) return null;

  const [, year, month, day, hour = "00", minute = "00"] = match;

  return zonedTimeToUtc({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  });
}

/** Medianoche de hoy en la zona de la fábrica, como instante absoluto. */
function startOfDayInZone(reference: Date): Date {
  const parts = zonedParts(reference);

  return zonedTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
  });
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Hora de pared en la zona de la fábrica → instante UTC.
 *
 * Se resuelve midiendo el desfase real de esa fecha en vez de restar un
 * offset fijo: Veracruz ya no aplica horario de verano, pero la zona es
 * configurable y una fábrica en otro huso sí lo tendría. Con un offset
 * quemado, dos veces al año los turnos saldrían corridos una hora.
 */
function zonedTimeToUtc(wall: WallClock): Date {
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
  );

  // Primera pasada: cuánto se desfasa esa marca al leerla en la zona.
  const offset = offsetAt(new Date(asUtc));
  const candidate = new Date(asUtc - offset);

  /* Segunda pasada: cerca de un cambio de horario el desfase del instante
     candidato puede diferir del de la marca original. Se recalcula con el
     candidato, que es la aproximación buena. */
  const corrected = offsetAt(candidate);
  if (corrected === offset) return candidate;

  return new Date(asUtc - corrected);
}

/** Milisegundos que la zona va por delante de UTC en ese instante. */
function offsetAt(instant: Date): number {
  const parts = zonedParts(instant);

  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  // Se recorta a segundos: `instant` puede traer milisegundos que la zona no
  // reporta, y sin esto el desfase saldría con un residuo.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Descompone un instante en su hora de pared dentro de la zona. */
function zonedParts(instant: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const values = new Map<string, number>();
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") values.set(part.type, Number(part.value));
  }

  const read = (key: string) => values.get(key) ?? 0;
  const hour = read("hour");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    // A medianoche algunos entornos reportan "24" en vez de "00".
    hour: hour === 24 ? 0 : hour,
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * "19 ago, 06:00" — corto, porque se pinta junto a los KPIs.
 *
 * En 24 horas y no en a.m./p.m.: los turnos de la fábrica se nombran así
 * ("el de las 14"), y "06:00 a.m." ocupa el doble de ancho en el celular.
 */
function formatStamp(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIMEZONE,
  }).format(date);
}

/**
 * A qué día calendario pertenece un instante, en la zona de la fábrica.
 *
 * Devuelve "2026-08-19". Se agrupa por esto y no por la fecha UTC porque una
 * recepción de las 19:00 de Veracruz cae en el día siguiente en UTC, y el
 * reporte diario la mostraría en la fecha equivocada —justo el día que el
 * auxiliar viene a cuadrar lo que recibió.
 */
export function zonedDayKey(instant: Date): string {
  const parts = zonedParts(instant);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Valor para un `<input type="datetime-local">` en la zona de la fábrica. */
export function toLocalInputValue(date: Date): string {
  const parts = zonedParts(date);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
