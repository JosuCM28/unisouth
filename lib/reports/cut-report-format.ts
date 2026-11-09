import { formatQuantity } from "@/lib/utils";

/**
 * Formato de las cifras del reporte de corte.
 *
 * Una sola vez para pantalla y PDF: si cada uno redondeara a su manera, la
 * hoja impresa diría 12.4% y la pantalla 12%, y en junta alguien va a
 * preguntar cuál es la buena.
 */

const NO_DATA = "—";

/** 0.124 → "12.4%" */
export function formatRate(rate: number | null, decimals = 1): string {
  if (rate === null) return NO_DATA;
  return `${formatQuantity(rate * 100, { decimals })}%`;
}

/** 0.124 → "+12.4%", −0.05 → "−5%" */
export function formatChange(rate: number | null): string {
  if (rate === null) return NO_DATA;
  return `${signOf(rate)}${formatRate(Math.abs(rate))}`;
}

/** 120 → "+120", −45 → "−45" */
export function formatDifference(value: number | null): string {
  if (value === null) return NO_DATA;
  return `${signOf(value)}${formatQuantity(Math.abs(value))}`;
}

function signOf(value: number): string {
  if (value > 0) return "+";
  if (value < 0) return "−";
  return "";
}

/** La línea chica de una cifra: contra qué se está comparando. */
export function changeHint(rate: number | null): string {
  if (rate === null) return "Sin corte previo para comparar";
  return `${formatChange(rate)} vs. periodo anterior`;
}
