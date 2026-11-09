import type { Prisma } from "@prisma/client";
import { effectiveCaptureDate } from "@/lib/cutting/capture-dates";
import {
  CutReportRepository,
  type OpenOrderRow,
  type WorkedOrderRow,
} from "@/lib/repositories/cut-report.repository";
import {
  buildCutReport,
  earliestKeyNeeded,
  type CutBatchFact,
  type CutOrderFact,
  type CutReportData,
  type OpenOrderFact,
} from "@/lib/reports/cut-report-calculations";
import { dayEnd, dayStart, type ReportPeriod } from "@/lib/report-period";
import { toDateInputValue, todayInputValue } from "@/lib/utils";

/**
 * El reporte de corte para dirección.
 *
 * No extiende BaseService por lo mismo que ReportService: sólo consulta, no
 * genera folios ni audita.
 *
 * Trae los cortes y suma en memoria, y no agrupa en SQL, porque cada cifra
 * depende del día EN LA FÁBRICA y del último corte de cada orden. Son pocas
 * filas —cortes de un par de meses, no el kárdex completo— y a cambio las
 * cuentas viven en funciones puras que se pueden revisar.
 */
export class CutReportService {
  constructor(private readonly repository = new CutReportRepository()) {}

  async getReport(period: ReportPeriod): Promise<CutReportData> {
    const [worked, open] = await Promise.all([
      this.repository.findWorkedOrders(
        dayStart(earliestKeyNeeded(period)),
        dayEnd(period.toKey),
      ),
      this.repository.findOpenOrders(),
    ]);

    return buildCutReport(
      worked.map(toOrderFact),
      open.map(toOpenFact),
      period,
      todayInputValue(),
    );
  }
}

function toOrderFact(row: WorkedOrderRow): CutOrderFact {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    clientId: row.client?.id ?? null,
    clientName: row.client?.name ?? null,
    ordered: row.lines.reduce((total, line) => total + line.orderedQuantity, 0),
    metersDelivered: toNumber(row.metersDelivered),
    metersSpread: toNumber(row.metersSpread),
    smallRemnant: toNumber(row.smallRemnant),
    batches: row.batches.flatMap(toBatchFacts),
  };
}

/**
 * Un hecho por cada día en que el corte tuvo captura.
 *
 * Casi siempre es uno solo; son más cuando a un corte viejo le agregaron
 * bultos. Cada día se lleva sus piezas, y `batchId` hace que siga contando
 * como un solo corte.
 */
function toBatchFacts(batch: WorkedOrderRow["batches"][number]): CutBatchFact[] {
  const pieces = new Map<string, number>();

  for (const entry of batch.entries) {
    const dayKey = toDateInputValue(
      effectiveCaptureDate(entry.capturedAt, batch.openedAt),
    );
    // Por bulto: la captura guarda piezas de cada bulto y cuántos bultos.
    pieces.set(
      dayKey,
      (pieces.get(dayKey) ?? 0) + entry.quantity * entry.bundles,
    );
  }

  return [...pieces].map(([dayKey, total]) => ({
    batchId: batch.id,
    dayKey,
    pieces: total,
  }));
}

function toOpenFact(row: OpenOrderRow): OpenOrderFact {
  return {
    dueKey: row.dueDate ? toDateInputValue(row.dueDate) : null,
    lines: row.lines,
  };
}

/** Sin captura es `null`, no cero: "no se ha medido" no es "salió cero". */
function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}
