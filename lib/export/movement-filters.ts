import { MovementDirection, MovementType } from "@prisma/client";
import type { MovementFilters } from "@/lib/repositories/movement.repository";
import { fromDateInputValue } from "@/lib/utils";

/**
 * Filtros del kárdex, leídos de la URL.
 *
 * Viven aparte de la página porque la lista, el Excel y la hoja impresa tienen
 * que entender los MISMOS parámetros.
 */
export interface MovementSearchParams {
  direction?: string;
  type?: string;
  materialId?: string;
  from?: string;
  to?: string;
}

/* Tomados del enum de Prisma: escribirlos a mano obligaría a acordarse de
   este archivo al agregar un tipo de movimiento, y el olvido sería silencioso. */
const DIRECTIONS = new Set<string>(Object.keys(MovementDirection));
const TYPES = new Set<string>(Object.keys(MovementType));

export function parseMovementFilters(
  params: MovementSearchParams,
): MovementFilters {
  return {
    direction:
      params.direction && DIRECTIONS.has(params.direction)
        ? (params.direction as MovementDirection)
        : undefined,
    type:
      params.type && TYPES.has(params.type)
        ? (params.type as MovementType)
        : undefined,
    materialId: params.materialId || undefined,
    /* Anclados a la zona de la fábrica: `new Date("2026-08-17")` es medianoche
       UTC, que aquí son las 6 de la tarde del 16, así que el rango se corría
       un día. Y "hasta el 16" incluye todo el 16, hasta las 23:59. */
    from: params.from ? fromDateInputValue(params.from) : undefined,
    to: params.to ? fromDateInputValue(params.to, "end") : undefined,
  };
}

/** Lee los mismos parámetros desde una petición HTTP. */
export function movementFiltersFromRequest(request: Request): MovementFilters {
  const query = new URL(request.url).searchParams;
  const read = (key: keyof MovementSearchParams) => query.get(key) ?? undefined;

  return parseMovementFilters({
    direction: read("direction"),
    type: read("type"),
    materialId: read("materialId"),
    from: read("from"),
    to: read("to"),
  });
}
