import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { FinishedGoodsRepository, type FinishedStockRow } from "@/lib/repositories/finished-goods.repository";
import { finishedGoodsFiltersFromRequest } from "@/lib/export/finished-goods-filters";
import { toXlsxWithNotice, xlsxResponse, type XlsxColumn } from "@/lib/export/xlsx";
import {
  NO_CATEGORY_LABEL,
  NO_CLIENT_LABEL,
  NO_PO_LABEL,
} from "@/components/finished-goods/finished-stock-labels";

/**
 * Las mismas columnas que la tabla. Piezas como NÚMERO: lo primero que se hace
 * con el archivo es seleccionar la columna para ver el total, y con texto
 * Excel no suma nada.
 */
const COLUMNS: XlsxColumn<FinishedStockRow>[] = [
  { header: "Producto", value: (r) => r.product.name, width: 36 },
  { header: "Código", value: (r) => r.product.code, width: 18 },
  { header: "Tipo", value: (r) => r.product.garmentCategory?.name ?? NO_CATEGORY_LABEL, width: 14 },
  { header: "Talla", value: (r) => r.size.code, width: 8 },
  { header: "PO", value: (r) => r.clientPo ?? NO_PO_LABEL, width: 14 },
  { header: "Cliente", value: (r) => r.client?.name ?? NO_CLIENT_LABEL, width: 24 },
  { header: "Piezas", value: (r) => r.quantity, kind: "number" },
];

export async function GET(request: Request) {
  // Recorre la tabla completa: sin límite sería un vector de denegación.
  await enforceRateLimit("export:finished-goods", EXPORT_LIMIT);
  await requirePermission("finished-goods:browse");

  // Los MISMOS filtros que la pantalla: sin ninguno, sale todo el inventario.
  const rows = await new FinishedGoodsRepository().findAllForExport(finishedGoodsFiltersFromRequest(request));

  return xlsxResponse(toXlsxWithNotice(rows, COLUMNS, "Inventario terminado"), "inventario-terminado");
}
