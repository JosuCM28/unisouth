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
  clientId?: string;
  status?: string;
  from?: string;
  to?: string;
}

/** Estados válidos. Cualquier otra cosa en la URL se ignora en vez de tronar. */
const STATUSES = new Set(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

export function parseCuttingOrderFilters(
  params: Record<string, string | undefined>,
): CuttingOrderFilters {
  return {
    clientId: params.client || undefined,
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
