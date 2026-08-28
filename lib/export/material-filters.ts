import type { MaterialFilters } from "@/lib/repositories/material.repository";

/**
 * Filtros del catálogo de materiales, leídos de la URL.
 *
 * Hoy es sólo el buscador, pero vive aquí por la misma razón que los otros: la
 * lista y el Excel deben leer lo mismo. Cuando se agregue un filtro por tipo o
 * por activo, se agrega en un solo lugar y las dos pantallas lo entienden.
 */
export interface MaterialSearchParams {
  q?: string;
}

export function parseMaterialFilters(
  params: MaterialSearchParams,
): MaterialFilters {
  return { search: params.q || undefined };
}

/** Lee los mismos parámetros desde una petición HTTP. */
export function materialFiltersFromRequest(request: Request): MaterialFilters {
  const query = new URL(request.url).searchParams;
  return parseMaterialFilters({ q: query.get("q") ?? undefined });
}
