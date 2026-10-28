import { LotRepository } from "@/lib/repositories/lot.repository";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { lotFiltersFromRequest } from "@/lib/export/lot-filters";
import {
  inMicrosipUnits,
  materialsWithMixedUnits,
  microsipStockRows,
  mixedUnitsResponse,
} from "@/lib/export/microsip";
import { toPlainXlsx } from "@/lib/export/xlsx-plain";
import { xlsxResponse } from "@/lib/export/xlsx";

/** Existencias por material, listas para la entrada de SALDO INICIAL. */
export async function GET(request: Request) {
  await enforceRateLimit("export:microsip", EXPORT_LIMIT);

  await requirePermission("inventory:browse");

  // Ya en yardas y con un renglón por clave: así lo lleva Microsip.
  const rows = inMicrosipUnits(await new LotRepository().sumByMaterialForExport(
    lotFiltersFromRequest(request),
  ));

  const mixed = materialsWithMixedUnits(rows);
  if (mixed.length > 0) return mixedUnitsResponse(mixed);

  return xlsxResponse(
    toPlainXlsx(microsipStockRows(rows), "Existencias"),
    "microsip-existencias",
  );
}
