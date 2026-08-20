/**
 * Ventanas del historial de un material.
 *
 * Vive en un archivo SIN "use client", igual que `report-ranges.ts`: si se
 * declarara dentro del componente de pestañas, la página —Server Component—
 * recibiría una referencia de módulo en vez del array y reventaría en runtime
 * con un `.map is not a function` que el compilador no detecta.
 *
 * Son las ventanas que de verdad se preguntan en la bodega: lo de hoy, lo de
 * la semana, el mes y el año. Para cualquier otra cosa está el rango con
 * fecha y hora, que es lo que responde "hoy de las 6 a las 8".
 */
export const HISTORY_RANGES = [
  { key: "hoy", label: "Hoy", days: 0 },
  { key: "7", label: "7 días", days: 7 },
  { key: "30", label: "Mes", days: 30 },
  { key: "365", label: "Año", days: 365 },
] as const;

export type HistoryRangeKey = (typeof HISTORY_RANGES)[number]["key"];

export const DEFAULT_HISTORY_RANGE: HistoryRangeKey = "30";

export function isHistoryRange(value: unknown): value is HistoryRangeKey {
  return HISTORY_RANGES.some((range) => range.key === value);
}
