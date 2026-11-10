import { NotFoundError } from "@/lib/core/errors";
import { fileErrorResponse } from "@/lib/core/file-error-response";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { requirePermission } from "@/lib/core/session";
import {
  parseWorkshopBoardKey,
  WORKSHOP_BOARDS,
} from "@/lib/constants/workshop-access";
import { xlsxResponse } from "@/lib/export/xlsx";
import { resolveReportPeriod } from "@/lib/report-period";
import { WorkshopReportService } from "@/lib/services/workshop-report.service";

/** Lo que se acepta del buscador: lo mismo que cabe en la caja. */
const MAX_SEARCH = 100;

/**
 * El reporte de entregas de un tablero de taller.
 *
 * Cada tablero exige SU llave: un taller sólo baja el suyo, y ADMIN los
 * cuatro. La clave de la URL sólo elige una de cuatro entradas fijas; el
 * taller sale de su rol, nunca de un id que mande el navegador.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ board: string }> },
) {
  try {
    // Recorre un periodo entero dos veces: sin tope es un vector de abuso.
    await enforceRateLimit("export:workshop-board", EXPORT_LIMIT);

    const key = parseWorkshopBoardKey((await params).board);
    if (!key) throw new NotFoundError("el tablero");
    const board = WORKSHOP_BOARDS[key];

    await requirePermission(board.permission);

    const url = new URL(request.url);
    const period = resolveReportPeriod({
      mes: url.searchParams.get("mes") ?? undefined,
      desde: url.searchParams.get("desde") ?? undefined,
      hasta: url.searchParams.get("hasta") ?? undefined,
    });
    const search = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_SEARCH);

    const result = await new WorkshopReportService().exportBoard({
      boardRole: board.role,
      period,
      search,
    });
    if (!result) throw new NotFoundError("el taller de este tablero");

    const range = period.month ?? `${period.fromKey}_${period.toKey}`;
    return xlsxResponse(result.file, `entregas-${key}-${range}`);
  } catch (error) {
    return fileErrorResponse(error);
  }
}
