import { LOT_STATUS_LABELS } from "@/lib/constants/labels";
import type { LotSearchParams } from "./lot-filters";
import type { LotStatus } from "@prisma/client";

/**
 * Describe en palabras el filtro que produjo una hoja.
 *
 * Una hoja impresa se separa de la pantalla que la generó: alguien la deja en
 * un escritorio y al día siguiente nadie sabe si es el inventario completo o
 * el de un cliente. Impreso el criterio, la hoja se explica sola.
 *
 * Los ids NO se traducen a nombres aquí: eso obligaría a consultar cuatro
 * catálogos para imprimir un encabezado. Lo que sí se dice es QUÉ se acotó, y
 * el conteo de la hoja hace el resto —si dice "material acotado · 12 rollos",
 * nadie la confunde con el inventario entero—.
 */
export function describeLotFilters(params: LotSearchParams): string[] {
  const parts: string[] = [];

  if (params.q) parts.push(`búsqueda "${params.q}"`);
  if (params.materialId) parts.push("un material");
  if (params.locationId) parts.push("una ubicación");
  if (params.clientId) parts.push("un cliente");
  if (params.colorName) parts.push(`color ${params.colorName}`);
  if (params.shade) parts.push(`tono ${params.shade}`);

  if (params.status && params.status in LOT_STATUS_LABELS) {
    parts.push(LOT_STATUS_LABELS[params.status as LotStatus]);
  }

  if (params.onlyRemnants === "true") parts.push("sólo retazos");
  if (params.onlyUnverified === "true") parts.push("sólo sin medir");
  if (params.includeCancelled === "true") parts.push("incluye cancelados");

  if (params.arrivedWithin) {
    parts.push(`llegados en ${params.arrivedWithin} días`);
  }

  return parts.length > 0 ? parts : ["sin filtro, todo el almacén"];
}
