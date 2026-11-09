import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { buildCutSummaryWorkbook } from "@/lib/export/cut-summary-sheet";
import { xlsxResponse } from "@/lib/export/xlsx";
import { resolveReportPeriod } from "@/lib/report-period";
import { CutReportService } from "@/lib/services/cut-report.service";

export async function GET(request: Request) {
  // Recorre los cortes de meses enteros: sin tope es un vector de denegación.
  await enforceRateLimit("export:cut-summary", EXPORT_LIMIT);

  await requirePermission("reporting:read");

  const { searchParams } = new URL(request.url);
  const period = resolveReportPeriod({
    mes: searchParams.get("mes") ?? undefined,
    desde: searchParams.get("desde") ?? undefined,
    hasta: searchParams.get("hasta") ?? undefined,
  });

  const report = await new CutReportService().getReport(period);

  return xlsxResponse(
    buildCutSummaryWorkbook(report),
    `reporte-corte-${period.fromKey}-a-${period.toKey}`,
  );
}
