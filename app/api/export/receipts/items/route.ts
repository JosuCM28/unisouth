import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { toXlsx, xlsxResponse } from "@/lib/export/xlsx";
import { ReceiptRepository } from "@/lib/repositories/receipt.repository";
import {
  MAILED_ITEM_COLUMNS,
  mailedItemRows,
} from "@/lib/receipts/mailed-items";

/**
 * Todos los números de ítem que han salido en correos de recepción, uno por
 * renglón, con la tela y la recepción a la que corresponden.
 *
 * NO respeta los filtros de la pantalla, a propósito: la pregunta es "¿qué
 * era el ítem 100?", y con un filtro puesto el número podría quedar fuera y
 * parecer que nunca existió.
 */
export async function GET() {
  await enforceRateLimit("export:receipt-items", EXPORT_LIMIT);
  await requirePermission("inventory:browse");

  const receipts = await new ReceiptRepository().findMailed();

  return xlsxResponse(
    toXlsx(mailedItemRows(receipts), MAILED_ITEM_COLUMNS, "Ítems enviados"),
    "items-de-recepcion",
  );
}
