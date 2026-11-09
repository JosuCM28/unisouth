import { effectiveCaptureDate } from "@/lib/cutting/capture-dates";
import {
  CutReportRepository,
  type CapturedCutRow,
} from "@/lib/repositories/cut-report.repository";
import {
  buildCutDetail,
  type CutDetailData,
  type CutDetailFact,
  type CutDetailSizeFact,
} from "@/lib/reports/cut-detail-calculations";
import {
  dayEnd,
  dayStart,
  type CutDetailGroup,
  type ReportPeriod,
} from "@/lib/report-period";
import { toDateInputValue } from "@/lib/utils";

/** El detalle de lo cortado. Sólo consulta, como el resto de los reportes. */
export class CutDetailService {
  constructor(private readonly repository = new CutReportRepository()) {}

  async getReport(
    period: ReportPeriod,
    group: CutDetailGroup,
  ): Promise<CutDetailData> {
    const rows = await this.repository.findCapturedCuts(
      dayStart(period.fromKey),
      dayEnd(period.toKey),
    );

    /* El filtro por día se repite aquí porque la consulta trae el corte
       completo: uno con un bulto en el periodo también trae los de otros días,
       y ésos no son de este reporte. */
    const facts = rows
      .flatMap(toFacts)
      .filter(
        (fact) => fact.dayKey >= period.fromKey && fact.dayKey <= period.toKey,
      );

    return buildCutDetail(facts, period, group);
  }
}

type CapturedEntry = CapturedCutRow["entries"][number];

/** Un hecho por cada día en que el corte tuvo captura. */
function toFacts(row: CapturedCutRow): CutDetailFact[] {
  const openedKey = toDateInputValue(row.openedAt);
  const entriesByDay = new Map<string, CapturedEntry[]>();

  for (const entry of row.entries) {
    const dayKey = toDateInputValue(
      effectiveCaptureDate(entry.capturedAt, row.openedAt),
    );
    entriesByDay.set(dayKey, [...(entriesByDay.get(dayKey) ?? []), entry]);
  }

  return [...entriesByDay].map(([dayKey, entries]) =>
    toFact(row, dayKey, entries, dayKey === openedKey),
  );
}

function toFact(
  row: CapturedCutRow,
  dayKey: string,
  entries: CapturedEntry[],
  isOpeningDay: boolean,
): CutDetailFact {
  /* Quien abrió el corte responde por el día en que lo abrió; lo agregado
     después es de quien lo guardó. Los cortes que dedujo la migración no
     tienen quien los abrió, y ahí también se cae a quien guardó. */
  const opener = isOpeningDay ? row.createdBy?.name : undefined;

  return {
    id: `${row.id}-${dayKey}`,
    batchId: row.id,
    dayKey,
    cutNumber: row.number,
    cutLabel: row.label,
    orderId: row.order.id,
    orderCode: row.order.code,
    clientName: row.order.client?.name ?? null,
    description: row.order.description,
    capturedBy: opener ?? entries[0]?.user?.name ?? null,
    bundles: entries.reduce((total, entry) => total + entry.bundles, 0),
    sizes: mergeSizes(entries),
  };
}

/**
 * Una talla por renglón, ya sumada.
 *
 * La captura guarda un renglón por bulto distinto —uno de 30 y otro de 20 de la
 * misma talla—, pero aquí la pregunta es cuántas salieron de cada talla.
 */
function mergeSizes(entries: CapturedEntry[]): CutDetailSizeFact[] {
  const sizes = new Map<string, CutDetailSizeFact & { order: number }>();

  for (const entry of entries) {
    const { code, order } = entry.line.size;
    const row = sizes.get(code) ?? { code, order, pieces: 0 };

    row.pieces += entry.quantity * entry.bundles;
    sizes.set(code, row);
  }

  return [...sizes.values()]
    .sort((a, b) => a.order - b.order || a.code.localeCompare(b.code))
    .map(({ code, pieces }) => ({ code, pieces }));
}
