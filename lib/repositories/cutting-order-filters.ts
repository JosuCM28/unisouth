import type { CuttingOrderOrigin, Prisma } from "@prisma/client";
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
  /**
   * Sobre qué fecha corre el rango.
   *
   * `orderedAt` —el día que el cliente pidió— es lo que quiere la lista y el
   * reporte del mes: se arma con lo que se pidió en ese mes aunque se haya
   * capturado tarde. `updatedAt` es lo que quiere el concentrado del día: al
   * cerrar la jornada se baja TODO lo que se tocó hoy, y una orden de la
   * semana pasada a la que hoy se le anotaron los metros tiene que salir.
   *
   * Son dos preguntas distintas y ninguna sustituye a la otra, por eso el
   * campo existe en vez de haber cambiado el comportamiento de uno solo.
   */
  dateField?: "orderedAt" | "updatedAt";
  /**
   * De qué planta salió. Sin esto, las dos listas se mezclan.
   *
   * `/orders` no lo usa —le basta con `adopted`, porque una orden de la casa
   * siempre está agregada— pero el módulo de planta sí: ahí se ven las de
   * allá abajo estén agregadas o no.
   */
  origin?: CuttingOrderOrigin;
  /**
   * Si ya entró al concentrado de la casa.
   *
   * `true` es lo que pide la lista de Órdenes: las de la casa (que nacen
   * agregadas) más las de planta que alguien ya jaló. `false` es el chip de
   * "pendientes" del módulo de planta. Sin valor, todas.
   */
  adopted?: boolean;
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
    /* Cualquier otra cosa cae al día del pedido, que es lo que hace la lista:
       un parámetro mal escrito en la URL no debe cambiar en silencio qué
       significa el rango de fechas que se está viendo. */
    dateField: params.dateField === "updatedAt" ? "updatedAt" : "orderedAt",
    /* Sólo se lee de la URL el estado del agregado, que es un chip de la
       pantalla. El ORIGEN no: lo fija cada página en el servidor, porque es
       lo que separa las dos listas y no algo que el usuario deba poder
       cambiar tecleando en la barra de direcciones. */
    adopted: parseAdopted(params.agregadas),
  };
}

/** El chip de agregadas: "1" sí, "0" no, cualquier otra cosa no filtra. */
function parseAdopted(value: string | undefined): boolean | undefined {
  if (value === "1") return true;
  if (value === "0") return false;
  return undefined;
}

export function cuttingOrderWhere(
  filters: CuttingOrderFilters,
): Prisma.CuttingOrderWhereInput {
  const where: Prisma.CuttingOrderWhereInput = {};

  if (filters.clientId) where.clientId = filters.clientId;

  if (filters.origin) where.origin = filters.origin;

  /* `addedAt` es el semáforo entero: con fecha está en el concentrado, sin
     ella sólo existe en el módulo de su planta. Las de la casa nacen con
     fecha, así que este filtro nunca las esconde. */
  if (filters.adopted === true) where.addedAt = { not: null };
  if (filters.adopted === false) where.addedAt = null;

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

  /* El rango corre sobre la fecha del PEDIDO salvo que se pida otra cosa: el
     reporte mensual del cliente se arma con lo que él pidió en ese mes, aunque
     se haya capturado tarde. Las horas se abren al día completo en la zona de
     la fábrica: con las fechas crudas, una orden de las 6 de la tarde quedaba
     fuera de su propio día. */
  if (filters.from || filters.to) {
    const from = filters.from ? fromDateInputValue(filters.from, "start") : undefined;
    const to = filters.to ? fromDateInputValue(filters.to, "end") : undefined;

    if (from || to) {
      const range = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };

      if (filters.dateField === "updatedAt") {
        where.updatedAt = range;
      } else {
        where.orderedAt = range;
      }
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
