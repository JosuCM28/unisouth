import { getPileSheetData, type PileSheetData } from "@/lib/pile-sheet-data";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";

/** Los filtros de "Rollos de esta pila", tal como llegan en la URL. */
export interface MaterialInventoryParams {
  clientId?: string;
  locationId?: string;
  colorName?: string;
  shade?: string;
}

export interface MaterialInventoryReport {
  data: PileSheetData;
  /** El filtro en palabras, para imprimirlo en la hoja. */
  criteria: string[];
}

/**
 * El inventario de UN material, por tono y rollo por rollo, para el Excel y
 * el PDF de su ficha.
 *
 * Los dos archivos salen de aquí para que digan lo mismo: si cada uno leyera
 * los filtros por su lado, el día que se agregue uno nuevo el PDF y el Excel
 * del mismo material empezarían a no cuadrar entre sí.
 *
 * Respeta los filtros de la pila que está en pantalla: quien filtró por un
 * cliente y bajó el archivo espera la tela de ese cliente, no la bodega entera.
 */
export async function getMaterialInventoryReport(
  materialId: string,
  params: MaterialInventoryParams,
): Promise<MaterialInventoryReport | null> {
  const data = await getPileSheetData({
    materialId,
    clientId: params.clientId || undefined,
    locationId: params.locationId || undefined,
    colorName: params.colorName || undefined,
    shade: params.shade || undefined,
    limit: EXPORT_ROW_LIMIT,
  });

  if (!data) return null;

  return { data, criteria: describeCriteria(data, params) };
}

/**
 * Dueño y ubicación llegan como id; el nombre se toma de los rollos que
 * devolvió el filtro, que por fuerza son de ese dueño y esa ubicación. Si el
 * filtro no trajo nada no hay de dónde sacarlo, y se dice así.
 */
function describeCriteria(
  data: PileSheetData,
  params: MaterialInventoryParams,
): string[] {
  const criteria: string[] = [];

  if (params.clientId) {
    criteria.push(`dueño ${data.clientNames[0] ?? "seleccionado"}`);
  }
  if (params.locationId) {
    criteria.push(`ubicación ${data.locationNames[0] ?? "seleccionada"}`);
  }
  if (params.colorName) criteria.push(`color ${params.colorName}`);
  if (params.shade) criteria.push(`tono ${params.shade}`);

  return criteria.length > 0 ? criteria : ["todo lo que hay en bodega"];
}

/** Lee los filtros de una petición de descarga. */
export function inventoryParamsFromRequest(
  request: Request,
): MaterialInventoryParams {
  const search = new URL(request.url).searchParams;
  return {
    clientId: search.get("clientId") ?? undefined,
    locationId: search.get("locationId") ?? undefined,
    colorName: search.get("colorName") ?? undefined,
    shade: search.get("shade") ?? undefined,
  };
}
