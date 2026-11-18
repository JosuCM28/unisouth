import type { FinishedGoodsFilters } from "@/lib/validations/finished-goods.schema";

/** Los parámetros de la URL del inventario terminado, como los escribe la pantalla. */
export interface FinishedGoodsSearchParams {
  q?: string;
  tipo?: string;
  cliente?: string;
  po?: string;
  talla?: string;
}

/**
 * Filtros del inventario terminado, leídos de la URL.
 *
 * Aparte de la página porque la lista y el Excel tienen que entender los
 * MISMOS parámetros: un archivo que no corresponde a lo que se ve en pantalla
 * se ve igual de correcto y engaña a quien lo recibe.
 */
export function parseFinishedGoodsFilters(params: FinishedGoodsSearchParams): FinishedGoodsFilters {
  return {
    search: params.q || undefined,
    categoryId: params.tipo || undefined,
    clientId: params.cliente || undefined,
    clientPo: params.po || undefined,
    sizeId: params.talla || undefined,
  };
}

export function finishedGoodsFiltersFromRequest(request: Request): FinishedGoodsFilters {
  const params = new URL(request.url).searchParams;
  return parseFinishedGoodsFilters({
    q: params.get("q") ?? undefined,
    tipo: params.get("tipo") ?? undefined,
    cliente: params.get("cliente") ?? undefined,
    po: params.get("po") ?? undefined,
    talla: params.get("talla") ?? undefined,
  });
}
