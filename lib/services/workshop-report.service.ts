import type { WorkshopRole } from "@/lib/constants/workshop-access";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";
import { buildWorkshopBoardWorkbook } from "@/lib/export/workshop-board-sheet";
import { dayEnd, dayStart, type ReportPeriod } from "@/lib/report-period";
import { buildWorkshopBoardReport } from "@/lib/reports/workshop-board-report";
import {
  fromShipment,
  fromVoucher,
  type ReportDelivery,
} from "@/lib/reports/workshop-report-rows";
import { WorkshopDeliveryRepository } from "@/lib/repositories/workshop-delivery.repository";
import {
  WorkshopReportRepository,
  type WorkshopReportRows,
} from "@/lib/repositories/workshop-report.repository";
import { filterDeliveries } from "@/lib/workshop-delivery-search";
import { BaseService } from "./base.service";

export interface WorkshopBoardExport {
  file: Buffer;
  workshopName: string;
}

/**
 * El reporte de entregas de un tablero de taller, en Excel.
 *
 * El taller sale del ROL del tablero, igual que la pantalla: nunca de un id
 * que venga del navegador.
 */
export class WorkshopReportService extends BaseService {
  private readonly deliveries = new WorkshopDeliveryRepository();
  private readonly reports = new WorkshopReportRepository();

  /** `null` = ese tablero todavía no está ligado a ningún taller. */
  async exportBoard(input: {
    boardRole: WorkshopRole;
    period: ReportPeriod;
    search: string;
  }): Promise<WorkshopBoardExport | null> {
    const workshop = await this.deliveries.findWorkshopByRole(input.boardRole);
    if (!workshop) return null;

    const { period } = input;
    const [current, previous] = await Promise.all([
      this.reports.findPeriod(workshop, dayStart(period.fromKey), dayEnd(period.toKey)),
      this.reports.findPeriod(
        workshop,
        dayStart(period.previousFromKey),
        dayEnd(period.previousToKey),
      ),
    ]);

    /* El filtro del buscador se aplica a los DOS periodos: comparar "camisas
       de Ternium" de este mes contra TODO el mes pasado daría un cambio que
       no existe. */
    const rows = this.toRows(current, input.search);
    const previousRows = this.toRows(previous, input.search);

    const file = buildWorkshopBoardWorkbook({
      workshopName: workshop.name,
      period,
      search: input.search,
      rows,
      report: buildWorkshopBoardReport({
        rows,
        previousRows,
        fromKey: period.fromKey,
        toKey: period.toKey,
      }),
      truncated:
        current.shipments.length >= EXPORT_ROW_LIMIT ||
        current.vouchers.length >= EXPORT_ROW_LIMIT,
    });

    return { file, workshopName: workshop.name };
  }

  /** Dos orígenes, una sola lista por fecha: al taller no le importa cuál. */
  private toRows(data: WorkshopReportRows, search: string): ReportDelivery[] {
    const today = new Date();
    const rows = [
      ...data.shipments.map((row) => fromShipment(row, today)),
      ...data.vouchers.map((row) => fromVoucher(row, today)),
    ].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

    return filterDeliveries(rows, search);
  }
}
