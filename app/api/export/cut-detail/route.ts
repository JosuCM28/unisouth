import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { buildCutDetailWorkbook } from "@/lib/export/cut-detail-sheet";
import { xlsxResponse } from "@/lib/export/xlsx";
import {
  CUT_DETAIL_GROUP_PARAMS,
  parseCutDetailGroup,
  resolveReportPeriod,
} from "@/lib/report-period";
import { CutDetailService } from "@/lib/services/cut-detail.service";

export async function GET(request: Request) {
  // Recorre los cortes de todo el rango: sin tope es un vector de denegación.
  await enforceRateLimit("export:cut-detail", EXPORT_LIMIT);

  await requirePermission("reporting:read");

  const { searchParams } = new URL(request.url);
  const group = parseCutDetailGroup(searchParams.get("agrupar") ?? undefined);
  const period = resolveReportPeriod({
    mes: searchParams.get("mes") ?? undefined,
    desde: searchParams.get("desde") ?? undefined,
    hasta: searchParams.get("hasta") ?? undefined,
  });

  const report = await new CutDetailService().getReport(period, group);

  return xlsxResponse(
    buildCutDetailWorkbook(report),
    `detalle-corte-${CUT_DETAIL_GROUP_PARAMS[group]}-${period.fromKey}-a-${period.toKey}`,
  );
}
