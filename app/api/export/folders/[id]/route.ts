import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { OrderFolderRepository } from "@/lib/repositories/order-folder.repository";
import { buildConcentrateSheet } from "@/lib/export/folder-concentrate";
import { toXlsxDocument, xlsxResponse } from "@/lib/export/xlsx";

/**
 * El concentrado del pedido en Excel: una columna por orden, un renglón por
 * talla y la suma de cada talla en "A cortar".
 *
 * La ruta sólo cuida el permiso, el tope de descargas y la respuesta. El
 * armado de la hoja vive en `lib/export/folder-concentrate`, igual que el del
 * reporte de corte: es la parte que se revisa y se prueba, y dentro de una
 * ruta no se puede correr sin levantar una sesión.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Recorre el pedido entero con todas sus tallas: sin tope es un vector de
  // denegación, igual que las demás descargas.
  await enforceRateLimit("export:folder", EXPORT_LIMIT);
  /* La misma llave que abre el pedido: quien puede contestar "¿cómo va?" puede
     mandar el concentrado, aunque no capture nada. */
  await requirePermission("orders:browse");

  const { id } = await params;

  const folder = await new OrderFolderRepository().findForConcentrate(id);
  if (!folder) return new Response("Pedido no encontrado", { status: 404 });

  const { rows, widths } = buildConcentrateSheet(folder);

  return xlsxResponse(
    toXlsxDocument(rows, widths, "Total a cortar"),
    `total-a-cortar-${folder.code}`,
  );
}
