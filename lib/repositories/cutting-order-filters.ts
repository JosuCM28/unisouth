import type { Prisma } from "@prisma/client";
import { fromDateInputValue } from "@/lib/utils";

/**
 * Filtros de las órdenes de corte.
 *
 * Viven aparte de la página porque la lista y el Excel tienen que entender los
 * MISMOS parámetros: si cada uno los leyera a su manera, el archivo descargado
 * no correspondería a lo que se está viendo en pantalla, que es justo lo que
 * hace inservible un reporte.
 */
export interface CuttingOrderFilters {
  /**
   * Texto libre. Se parte en palabras y TODAS deben aparecer, cada una en
   * algún campo: quien busca una orden trae en la cabeza dos o tres datos
   * sueltos —"albero blusa"— y no el folio exacto.
   */
  search?: string;
  clientId?: string;
  status?: string;
  from?: string;
  to?: string;
  /**
   * Carpeta de pedido. El valor especial "none" trae las órdenes SUELTAS.
   *
   * Se necesita un valor explícito porque "sin filtro" y "sin carpeta" son
   * cosas distintas: la lista principal muestra sólo las sueltas, mientras
   * que el Excel de un cliente las quiere todas.
   */
  folderId?: string;
}

/** Valor del filtro que pide las órdenes que no están en ninguna carpeta. */
export const LOOSE_ORDERS = "none";

/** Cuántas palabras del buscador se consideran; el resto se descarta. */
const MAX_TERMS = 6;

/** Estados válidos. Cualquier otra cosa en la URL se ignora en vez de tronar. */
const STATUSES = new Set(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

export function parseCuttingOrderFilters(
  params: Record<string, string | undefined>,
): CuttingOrderFilters {
  return {
    search: params.q?.trim() || undefined,
    clientId: params.client || undefined,
    folderId: params.folder || undefined,
    status: params.status && STATUSES.has(params.status) ? params.status : undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };
}

export function cuttingOrderWhere(
  filters: CuttingOrderFilters,
): Prisma.CuttingOrderWhereInput {
  const where: Prisma.CuttingOrderWhereInput = {};

  if (filters.clientId) where.clientId = filters.clientId;

  if (filters.search) {
    /* AND de ORs: cada palabra tiene que aparecer en ALGÚN campo. Así
       "albero blusa" encuentra la orden de Albero cuya prenda es una blusa, en
       vez de todo lo que mencione cualquiera de las dos. */
    where.AND = tokenize(filters.search).map((term) => {
      const contains = { contains: term, mode: "insensitive" as const };

      return {
        OR: [
          { code: contains },
          { reference: contains },
          { description: contains },
          { notes: contains },
          { cutFabricText: contains },
          { cutPattern: contains },
          { cutVersionNotes: contains },
          { client: { name: contains } },
          { material: { name: contains } },
          { material: { code: contains } },
          { folder: { name: contains } },
          { folder: { code: contains } },
          // También por talla: a veces lo que se busca es "quién pidió 38".
          { lines: { some: { size: { code: contains } } } },
        ],
      };
    });
  }

  if (filters.folderId === LOOSE_ORDERS) {
    where.folderId = null;
  } else if (filters.folderId) {
    where.folderId = filters.folderId;
  }

  if (filters.status) {
    where.status = filters.status as Prisma.CuttingOrderWhereInput["status"];
  }

  /* El rango se toma sobre la fecha del PEDIDO, no la de captura: el reporte
     mensual del cliente se arma con lo que él pidió en ese mes, aunque se haya
     capturado tarde. Las horas se abren al día completo en la zona de la
     fábrica: con las fechas crudas, una orden de las 6 de la tarde quedaba
     fuera de su propio día. */
  if (filters.from || filters.to) {
    const from = filters.from ? fromDateInputValue(filters.from, "start") : undefined;
    const to = filters.to ? fromDateInputValue(filters.to, "end") : undefined;

    if (from || to) {
      where.orderedAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
  }

  return where;
}

/** Palabras de la búsqueda, sin vacíos y topadas a un máximo razonable. */
function tokenize(search: string): string[] {
  return search
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, MAX_TERMS);
}
