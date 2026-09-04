import type { DocumentStatus, Prisma } from "@prisma/client";

/**
 * Filtros del listado de salidas.
 *
 * Viven aparte de la página —igual que `cutting-order-filters`— porque la
 * lista y el paginador tienen que leer los MISMOS parámetros de la URL: si
 * cada uno los interpretara a su modo, cambiar de página perdería la búsqueda
 * que el usuario ya tenía puesta.
 */
export interface IssueFilters {
  /**
   * Texto libre. Se parte en palabras y TODAS deben aparecer (en cualquier
   * campo): quien busca una salida trae en la cabeza dos o tres datos sueltos
   * —"ternium blusa v2"— y no el folio exacto.
   */
  search?: string;
  status?: DocumentStatus;
  /**
   * Sólo los vales que nacieron de un envío a taller.
   *
   * Existe porque esos vales son indistinguibles del resto en la lista: llevan
   * folio OUT como cualquier salida y lo único que los delata es a quién se le
   * entregó. Quien pregunta "¿qué anda en maquila?" no tiene otra forma de
   * separarlos sin abrirlos uno por uno.
   */
  fromWorkshop?: boolean;
}

/** Estados válidos. Cualquier otra cosa en la URL se ignora en vez de tronar. */
const STATUSES = new Set<DocumentStatus>(["DRAFT", "APPLIED", "CANCELLED"]);

/** El valor que enciende el filtro de envíos a taller, tal cual va en la URL. */
export const WORKSHOP_ORIGIN = "taller";

/** Cuántas palabras del buscador se consideran; el resto se descarta. */
const MAX_TERMS = 6;

export function parseIssueFilters(
  params: Record<string, string | undefined>,
): IssueFilters {
  const status = params.status;

  return {
    search: params.q?.trim() || undefined,
    status:
      status && STATUSES.has(status as DocumentStatus)
        ? (status as DocumentStatus)
        : undefined,
    fromWorkshop: params.origin === WORKSHOP_ORIGIN || undefined,
  };
}

/**
 * `where` de Prisma para una salida.
 *
 * Siempre acota a `type: "ISSUE"`: los vales de entrada llevan su propio
 * registro y mezclarlos obligaría a mirar el tipo de cada renglón para saber
 * si el material entró o salió.
 */
export function issueWhere(
  filters: IssueFilters,
): Prisma.InventoryDocumentWhereInput {
  const where: Prisma.InventoryDocumentWhereInput = { type: "ISSUE" };

  if (filters.status) where.status = filters.status;

  /* `some: {}` —tiene AL MENOS un envío colgando, sin importar cuál— y no una
     columna propia en el documento: el vínculo ya existe desde el envío, y
     duplicarlo en el vale abriría la puerta a que los dos se contradigan. */
  if (filters.fromWorkshop) where.shipments = { some: {} };

  if (filters.search) {
    // AND de ORs: cada palabra tiene que aparecer en ALGÚN campo. Así
    // "ternium blusa" encuentra el vale de Ternium cuya prenda es una blusa,
    // en vez de todo lo que mencione cualquiera de las dos.
    where.AND = tokenize(filters.search).map((term) => ({
      OR: matchesTerm(term),
    }));
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

/**
 * Todos los lugares donde una palabra puede identificar la salida: su folio,
 * los datos del encabezado de corte, quién entregó y recibió, el cliente
 * dueño, la tela —del catálogo o escrita a mano—, el folio y la tela de los
 * rollos que llevó, y las tallas del desglose.
 *
 * Del envío a taller se buscan su folio, el taller y la etapa. El folio ya
 * viajaba dentro de las notas del vale, pero buscarlo ahí es un accidente:
 * basta con que alguien corrija esa nota para que "ENV-2026-0006" deje de
 * encontrar nada. Aquí se pregunta por el envío mismo.
 */
function matchesTerm(term: string): Prisma.InventoryDocumentWhereInput[] {
  const contains = { contains: term, mode: "insensitive" as const };

  return [
    { code: contains },
    { concept: contains },
    { reference: contains },
    { cutDescription: contains },
    { cutFabricText: contains },
    { cutPattern: contains },
    { cutVersionNotes: contains },
    { notes: contains },
    { handedOverBy: contains },
    { receivedBy: contains },
    { client: { name: contains } },
    { cutFabric: { name: contains } },
    { cutFabric: { code: contains } },
    { productionOrder: { code: contains } },
    { lines: { some: { lot: { code: contains } } } },
    { lines: { some: { lot: { material: { name: contains } } } } },
    { cutLines: { some: { size: { code: contains } } } },
    { cutLines: { some: { size: { name: contains } } } },
    { shipments: { some: { code: contains } } },
    { shipments: { some: { workshop: { name: contains } } } },
    { shipments: { some: { stage: { name: contains } } } },
  ];
}
