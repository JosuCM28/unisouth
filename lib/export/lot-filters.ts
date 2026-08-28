import { LotStatus } from "@prisma/client";
import type { LotFilters } from "@/lib/repositories/lot.repository";

/**
 * Filtros del inventario, leídos de la URL.
 *
 * Viven aparte de la página porque la lista y el Excel tienen que entender los
 * MISMOS parámetros. Antes cada uno los leía a su manera —de hecho el Excel no
 * los leía— y el archivo descargado no correspondía a lo que se estaba viendo
 * en pantalla, que es justo lo que vuelve inservible un reporte: quien lo
 * recibe cree que está mirando el resultado del filtro.
 */
export interface LotSearchParams {
  q?: string;
  materialId?: string;
  locationId?: string;
  clientId?: string;
  colorName?: string;
  shade?: string;
  status?: string;
  onlyRemnants?: string;
  onlyUnverified?: string;
  includeCancelled?: string;
  arrivedWithin?: string;
}

/**
 * Estados válidos, tomados del enum de Prisma y no de una lista a mano.
 *
 * Escribirlos aquí obligaría a acordarse de este archivo cada vez que se
 * agregue un estado, y el olvido sería silencioso: el filtro simplemente
 * dejaría de funcionar para el estado nuevo.
 */
const LOT_STATUSES = new Set<string>(Object.keys(LotStatus));

export function parseLotFilters(params: LotSearchParams): LotFilters {
  return {
    search: params.q || undefined,
    materialId: params.materialId || undefined,
    locationId: params.locationId || undefined,
    clientId: params.clientId || undefined,
    colorName: params.colorName || undefined,
    shade: params.shade || undefined,
    /* Un estado inventado en la URL se ignora: dejarlo pasar al `where`
       haría fallar la consulta entera y la pantalla quedaría en blanco. */
    status:
      params.status && LOT_STATUSES.has(params.status)
        ? (params.status as LotStatus)
        : undefined,
    isRemnant: params.onlyRemnants === "true" ? true : undefined,
    verified: params.onlyUnverified === "true" ? false : undefined,
    includeCancelled: params.includeCancelled === "true",
    arrivedWithinDays: parsePositiveInt(params.arrivedWithin),
  };
}

/** Lee los mismos parámetros desde una petición HTTP. */
export function lotFiltersFromRequest(request: Request): LotFilters {
  const query = new URL(request.url).searchParams;
  const read = (key: keyof LotSearchParams) => query.get(key) ?? undefined;

  return parseLotFilters({
    q: read("q"),
    materialId: read("materialId"),
    locationId: read("locationId"),
    clientId: read("clientId"),
    colorName: read("colorName"),
    shade: read("shade"),
    status: read("status"),
    onlyRemnants: read("onlyRemnants"),
    onlyUnverified: read("onlyUnverified"),
    includeCancelled: read("includeCancelled"),
    arrivedWithin: read("arrivedWithin"),
  });
}

/** Entero positivo o nada. Cualquier basura en la URL se ignora. */
export function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}
