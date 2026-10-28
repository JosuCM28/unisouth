import { LotRepository } from "@/lib/repositories/lot.repository";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { lotFiltersFromRequest } from "@/lib/export/lot-filters";
import {
  ansiTextResponse,
  inMicrosipUnits,
  materialsWithMixedUnits,
  microsipArticleRows,
  mixedUnitsResponse,
  toAnsiTsv,
} from "@/lib/export/microsip";

/**
 * Catálogo de artículos para darlos de alta en Microsip.
 *
 * Sale de los MISMOS rollos que el archivo de existencias —no del catálogo
 * entero de materiales— para que cada clave de la entrada tenga su artículo y
 * no se dé de alta en Microsip nada que no se va a cargar.
 */
export async function GET(request: Request) {
  await enforceRateLimit("export:microsip", EXPORT_LIMIT);

  await requirePermission("inventory:browse");

  // Ya en yardas y con un renglón por clave: así lo lleva Microsip.
  const rows = inMicrosipUnits(await new LotRepository().sumByMaterialForExport(
    lotFiltersFromRequest(request),
  ));

  const mixed = materialsWithMixedUnits(rows);
  if (mixed.length > 0) return mixedUnitsResponse(mixed);

  return ansiTextResponse(
    toAnsiTsv(microsipArticleRows(rows)),
    "microsip-articulos",
  );
}
