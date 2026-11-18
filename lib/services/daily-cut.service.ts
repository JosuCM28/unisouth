import { resolveReportPeriod } from "@/lib/report-period";
import {
  buildDailyCut,
  type DailyCutReport,
} from "@/lib/reports/daily-cut-calculations";
import { SizeRepository } from "@/lib/repositories/size.repository";
import { todayInputValue } from "@/lib/utils";
import { CutDetailService } from "./cut-detail.service";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export interface DailyCutParams {
  desde?: string;
  hasta?: string;
}

/**
 * "Lo cortado" del botón de Órdenes. Sólo consulta.
 *
 * Por omisión es HOY, no el mes: es la hoja que se le manda al jefe al
 * cerrar la jornada. Se apoya en el detalle de corte de Reportes para que el
 * día en que cae cada bulto se decida en un solo lugar.
 */
export class DailyCutService {
  constructor(
    private readonly detail = new CutDetailService(),
    private readonly sizes = new SizeRepository(),
  ) {}

  async getReport(params: DailyCutParams): Promise<DailyCutReport> {
    const today = todayInputValue();
    const period = resolveReportPeriod({
      desde: dayOr(params.desde, today),
      hasta: dayOr(params.hasta ?? params.desde, today),
    });

    const [detail, sizeOrder] = await Promise.all([
      this.detail.getReport(period, "day"),
      this.sizes.findScaleOrder(),
    ]);
    return buildDailyCut(detail, period, sizeOrder);
  }
}

function dayOr(value: string | undefined, fallback: string): string {
  return value && DAY_KEY.test(value) ? value : fallback;
}
