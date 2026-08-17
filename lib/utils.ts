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
