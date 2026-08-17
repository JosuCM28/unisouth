import type { LotStatus } from "@prisma/client";

/**
 * Agrupaciones de estados del rollo.
 *
 * Estaban repetidas en cuatro archivos con cuatro nombres distintos. El
 * riesgo no era la duplicación en sí, sino que alguien agregara un estado
 * nuevo al schema y lo sumara a tres de las cuatro listas: el tablero diría
 * un número, el mapa de bodega otro, y nadie sabría cuál creer.
 */

/**
 * El rollo sigue ocupando lugar en la bodega.
 *
 * Es lo que se cuenta cuando alguien pregunta "¿cuántos rollos hay?" o
 * "¿está llena la fila 3?". Excluye los agotados, los devueltos y los dados
 * de baja: siguen en la base por historial, pero ya no estorban.
 */
export const STATUSES_PHYSICALLY_PRESENT: readonly LotStatus[] = [
  "AVAILABLE",
  "RESERVED",
  "IN_USE",
  "REMNANT",
  "QUARANTINE",
] as const;

/**
 * De estos rollos se puede surtir a producción.
 *
 * Más estrecho que el anterior: un rollo reservado o en cuarentena ocupa
 * lugar pero no se puede tomar.
 */
export const STATUSES_ISSUABLE: readonly LotStatus[] = [
  "AVAILABLE",
  "REMNANT",
] as const;

/** El rollo ya no existe como tal: agotado o dado de baja. */
export const STATUSES_CONSUMED: readonly LotStatus[] = [
  "DEPLETED",
  "WRITTEN_OFF",
] as const;

/**
 * Desde estos estados el rollo puede pasar a retazo al bajar del umbral.
 *
 * Uno en cuarentena o defectuoso NO: sigue retenido, y volverlo retazo lo
 * pondría a la cabeza de la cola de surtido.
 */
export const STATUSES_REMNANT_ELIGIBLE: readonly LotStatus[] = [
  "AVAILABLE",
  "REMNANT",
  "IN_USE",
] as const;

/**
 * Versiones mutables para los `where` de Prisma, que no acepta `readonly`.
 * Se exponen ya listas para no escribir `[...LISTA]` en cada consulta.
 */
export const PHYSICALLY_PRESENT_FILTER = {
  in: [...STATUSES_PHYSICALLY_PRESENT],
};

export const ISSUABLE_FILTER = { in: [...STATUSES_ISSUABLE] };

export function isPhysicallyPresent(status: LotStatus): boolean {
  return STATUSES_PHYSICALLY_PRESENT.includes(status);
}

export function isRemnantEligible(status: LotStatus): boolean {
  return STATUSES_REMNANT_ELIGIBLE.includes(status);
}
