import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { buildDailyCutWorkbook } from "@/lib/export/daily-cut-sheet";
import { xlsxResponse } from "@/lib/export/xlsx";
import { DailyCutService } from "@/lib/services/daily-cut.service";

/** El Excel de "Lo cortado": el reporte diario de corte y tendido. */
export async function GET(request: Request) {
  // Recorre los cortes de todo el rango: sin tope es un vector de denegación.
  await enforceRateLimit("export:daily-cut", EXPORT_LIMIT);

  await requirePermission("orders:browse");

  const { searchParams } = new URL(request.url);
  const report = await new DailyCutService().getReport({
    desde: searchParams.get("desde") ?? undefined,
    hasta: searchParams.get("hasta") ?? undefined,
  });

  const range = report.fromKey === report.toKey
    ? report.fromKey
    : `${report.fromKey}-a-${report.toKey}`;
  return xlsxResponse(buildDailyCutWorkbook(report), `reporte-corte-tendido-${range}`);
}
