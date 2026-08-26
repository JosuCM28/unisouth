import type { LotStatus } from "@prisma/client";

/**
 * Agrupaciones de estados del rollo.
 *
 * Viven aquí y no en cada consulta para que agregar un estado al schema no
 * obligue a acordarse de sumarlo a cuatro listas distintas: el tablero diría
 * un número, el mapa de bodega otro, y nadie sabría cuál creer.
 */

/**
 * El rollo sigue ocupando lugar en la bodega.
 *
 * Excluye agotados, devueltos y dados de baja: siguen en la base por
 * historial, pero ya no estorban.
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

/** Prisma no acepta `readonly` en un `where`, así que van ya desempacadas. */
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
