import { AuditAction, Sensitivity } from "@prisma/client";
import type { AuditFilters } from "@/lib/repositories/audit.repository";
import { fromDateInputValue } from "@/lib/utils";

/**
 * Filtros de la bitácora, leídos de la URL.
 *
 * Viven aparte de la página porque la lista y el Excel tienen que entender los
 * MISMOS parámetros. Antes el Excel no leía ninguno y siempre bajaba los
 * últimos 100 registros: quien filtraba por una persona y un rango de fechas
 * recibía un archivo que no tenía nada que ver con su búsqueda.
 */
export interface AuditSearchParams {
  userId?: string;
  entity?: string;
  action?: string;
  sensitivity?: string;
  from?: string;
  to?: string;
}

/* Tomados del enum de Prisma y no de una lista a mano: escribirlos aquí
   obligaría a acordarse de este archivo al agregar una acción, y el olvido
   sería silencioso —el filtro dejaría de servir para la acción nueva—. */
const ACTIONS = new Set<string>(Object.keys(AuditAction));
const SENSITIVITIES = new Set<string>(Object.keys(Sensitivity));

export function parseAuditFilters(params: AuditSearchParams): AuditFilters {
  return {
    userId: params.userId || undefined,
    entity: params.entity || undefined,
    action:
      params.action && ACTIONS.has(params.action)
        ? (params.action as AuditAction)
        : undefined,
    sensitivity:
      params.sensitivity && SENSITIVITIES.has(params.sensitivity)
        ? (params.sensitivity as Sensitivity)
        : undefined,
    /* Anclados a la zona de la fábrica: `new Date("2026-08-17")` es medianoche
       UTC, que aquí son las 6 de la tarde del 16, así que el rango se corría
       un día. Y "hasta el 16" incluye todo el 16, hasta las 23:59. */
    from: params.from ? fromDateInputValue(params.from) : undefined,
    to: params.to ? fromDateInputValue(params.to, "end") : undefined,
  };
}

/** Lee los mismos parámetros desde una petición HTTP. */
export function auditFiltersFromRequest(request: Request): AuditFilters {
  const query = new URL(request.url).searchParams;
  const read = (key: keyof AuditSearchParams) => query.get(key) ?? undefined;

  return parseAuditFilters({
    userId: read("userId"),
    entity: read("entity"),
    action: read("action"),
    sensitivity: read("sensitivity"),
    from: read("from"),
    to: read("to"),
  });
}
