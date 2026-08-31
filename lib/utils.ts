import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Un Decimal de Prisma se reconoce por su método toNumber, sin importar el tipo. */
function isDecimalLike(value: object): value is { toNumber: () => number } {
  return "toNumber" in value && typeof Reflect.get(value, "toNumber") === "function";
}

/**
 * Convierte a number todo Decimal de Prisma que venga en la estructura,
 * recursivamente.
 *
 * Un Decimal es una instancia de clase, y los Server Components sólo pueden
 * mandar valores serializables al cliente. Sin esta conversión, pasar un lote
 * con su metraje a un Client Component revienta en runtime.
 *
 * Las fechas se dejan como Date: Next sí sabe serializarlas.
 */
export function toPlainObject<T>(value: T): PlainObject<T> {
  return convert(value) as PlainObject<T>;
}

function convert(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) return value.map(convert);

  if (typeof value === "object") {
    if (value instanceof Date) return value;
    if (isDecimalLike(value)) return value.toNumber();

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = convert(item);
    }
    return result;
  }

  return value;
}

/** El tipo resultante de toPlainObject: los Decimal se vuelven number. */
export type PlainObject<T> = T extends { toNumber: () => number }
  ? number
  : T extends Date
    ? Date
    : T extends Array<infer U>
      ? Array<PlainObject<U>>
      : T extends object
        ? { [K in keyof T]: PlainObject<T[K]> }
        : T;

const LOCALE = "es-MX";

/**
 * La zona horaria de la fábrica. Veracruz, México (UTC-6, sin horario de verano).
 *
 * Se fija explícitamente en vez de dejar que cada entorno ponga la suya: el
 * servidor de producción corre en UTC, así que sin esto un rollo capturado a
 * las 7 de la noche salía fechado al día siguiente. Las fechas se GUARDAN en
 * UTC —que es lo correcto— y sólo se traducen a hora local al mostrarlas.
 *
 * Se puede sobrescribir con APP_TIMEZONE si la fábrica se mueve de huso.
 */
export const APP_TIMEZONE =
  process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "America/Mexico_City";

/**
 * Cantidades de inventario. Por omisión hasta 2 decimales, pero sin forzar
 * ceros: "12 m" se lee mejor que "12.00 m" en la pantalla del celular.
 * El metraje de tela sí suele traer decimales; las piezas no.
 */
export function formatQuantity(
  value: number | string | { toNumber: () => number } | null | undefined,
  options?: { unit?: string; decimals?: number },
): string {
  const numeric = toNumber(value);
  if (numeric === null) return "—";

  const decimals = options?.decimals ?? 2;
  const formatted = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(numeric);

  return options?.unit ? `${formatted} ${options.unit}` : formatted;
}

export function formatCurrency(
  value: number | string | { toNumber: () => number } | null | undefined,
  currency = "MXN",
): string {
  const numeric = toNumber(value);
  if (numeric === null) return "—";

  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
  }).format(numeric);
}

export function formatDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

function toNumber(
  value: number | string | { toNumber: () => number } | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return value.toNumber();
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * De una fecha guardada al valor de un `<input type="date">` (YYYY-MM-DD).
 *
 * NO se usa `toISOString().slice(0, 10)`: eso convierte a UTC, y un rollo
 * capturado a las 7 de la noche en Veracruz aparecía fechado al día
 * siguiente. Aquí se pregunta qué día era en la fábrica, que es lo que el
 * usuario espera ver en el campo.
 */
export function toDateInputValue(
  value: Date | string | null | undefined,
): string {
  const date = toDate(value);
  if (!date) return "";

  // `en-CA` da exactamente YYYY-MM-DD, que es el formato que exige el input.
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

/** El día de hoy en la fábrica, listo para un `<input type="date">`. */
export function todayInputValue(): string {
  return toDateInputValue(new Date());
}

/**
 * De un "YYYY-MM-DD" de un input al instante correcto.
 *
 * `new Date("2026-08-17")` es medianoche UTC, que en Veracruz son las 6 de la
 * tarde del día 16: el registro quedaba fechado un día antes. Esto ancla la
 * fecha al inicio (o al final) del día EN LA FÁBRICA.
 */
export function fromDateInputValue(
  value: string,
  edge: "start" | "end" = "start",
): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const time = edge === "start" ? "00:00:00.000" : "23:59:59.999";
  // El desfase de la zona en esa fecha concreta, por si algún día aplica
  // horario de verano: se calcula contra el propio día, no contra hoy.
  const offset = timezoneOffset(`${value}T${time}Z`);

  return new Date(`${value}T${time}${offset}`);
}

/**
 * Desfase de APP_TIMEZONE en un instante dado, como "-06:00".
 *
 * Se deriva del propio `Intl` en vez de escribirlo a mano para que siga
 * siendo correcto si la zona cambia de reglas.
 */
function timezoneOffset(isoUtc: string): string {
  const date = new Date(isoUtc);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    timeZoneName: "longOffset",
  }).formatToParts(date);

  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  // Llega como "GMT-06:00"; el input necesita sólo "-06:00".
  const match = name.match(/GMT([+-]\d{2}:\d{2})/);

  return match?.[1] ?? "+00:00";
}

/**
 * Texto legible sobre un fondo de color.
 *
 * Los foleos ahora los define el usuario, así que el color del texto no se
 * puede tener escrito de antemano: se calcula por luminancia para que un
 * amarillo lleve texto negro y un azul marino lo lleve blanco. La fórmula es
 * la de luminancia relativa de WCAG.
 */
export function contrastText(background: string): string {
  const hex = background.replace("#", "");
  if (hex.length !== 6) return "#000000";

  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  const luminance =
    0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);

  // El umbral 0.4 —y no 0.5— porque en papel impreso el blanco sobre un tono
  // medio se lee peor que el negro.
  return luminance > 0.4 ? "#000000" : "#ffffff";
}

/**
 * Cómo va un corte contra lo que se pidió.
 *
 * Vive aquí y no en cada pantalla porque la lista, la ficha y el reporte
 * tienen que contar lo mismo. Antes cada una hacía `Math.max(0, pedido -
 * cortado)` por su cuenta y el excedente se perdía: cortar 125 de 122 se veía
 * igual que cortar exactamente 122, y el auxiliar no tenía cómo enterarse de
 * que sobraban 3 piezas.
 */
export interface CutProgress {
  /** Lo que todavía falta cortar. Cero si ya se alcanzó el pedido. */
  pending: number;
  /** Piezas cortadas DE MÁS. Cero mientras no se rebase el pedido. */
  surplus: number;
  /** Se llegó al pedido, con o sin excedente. */
  done: boolean;
}

export function cutProgress(ordered: number, cut: number): CutProgress {
  const difference = cut - ordered;

  return {
    pending: difference < 0 ? -difference : 0,
    surplus: difference > 0 ? difference : 0,
    done: difference >= 0,
  };
}

export interface CutTotals {
  ordered: number;
  cut: number;
  pending: number;
  surplus: number;
}

/**
 * El renglón de Total al pie de una hoja de corte.
 *
 * "Faltan" y "sobran" se suman COLUMNA POR COLUMNA, no se sacan del neto de
 * los totales. El neto miente en el pie: a una orden a la que le faltan 552
 * piezas de una talla y le sobran 4 repartidas en otras dos no "le faltan
 * 548" —hay 552 sin cortar y 4 de más, que son dos problemas distintos y se
 * arreglan por separado—. Restarlos entre sí desaparece el excedente de la
 * hoja, y el excedente es tela que ya se gastó.
 *
 * Es la misma razón por la que existe `cutProgress`: lo que se ve en un
 * renglón y lo que se ve en el pie tienen que estar contando lo mismo.
 */
export function cutTotals(
  lines: Array<{ orderedQuantity: number; cutQuantity: number }>,
): CutTotals {
  return lines.reduce<CutTotals>(
    (totals, line) => {
      const { pending, surplus } = cutProgress(
        line.orderedQuantity,
        line.cutQuantity,
      );

      return {
        ordered: totals.ordered + line.orderedQuantity,
        cut: totals.cut + line.cutQuantity,
        pending: totals.pending + pending,
        surplus: totals.surplus + surplus,
      };
    },
    { ordered: 0, cut: 0, pending: 0, surplus: 0 },
  );
}
