/**
 * Ventanas del reporte.
 *
 * Vive en un archivo SIN "use client" a propósito. Estaba dentro de
 * range-tabs.tsx, que es componente cliente, y al importarla desde la página
 * —Server Component— no llegaba el array sino una referencia de módulo:
 * `RANGE_OPTIONS.some is not a function` en runtime, con la pantalla en
 * blanco. El compilador no lo detecta porque los tipos sí cuadran.
 *
 * Son las tres ventanas que se preguntan de verdad: el mes, el trimestre y el
 * año. Un selector de fechas libre daría infinitas combinaciones que nadie
 * pide y obligaría a meter un calendario en pantalla de celular.
 */
export const RANGE_OPTIONS = [
  { days: 30, label: "Mes" },
  { days: 90, label: "Trimestre" },
  { days: 365, label: "Año" },
] as const;

export const DEFAULT_RANGE_DAYS = 30;

/** Días válidos. El valor viene de la URL y el usuario puede teclear cualquier cosa. */
export function parseRangeDays(value: string | null | undefined): number {
  const parsed = Number(value);
  const allowed = RANGE_OPTIONS.some((option) => option.days === parsed);
  return allowed ? parsed : DEFAULT_RANGE_DAYS;
}
