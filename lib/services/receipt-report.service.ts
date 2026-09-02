import {
  ReceiptRepository,
  sortGroups,
  type ReceiptCardData,
  type ReportGroupRow,
  type UnitTotal,
} from "@/lib/repositories/receipt.repository";
import {
  periodHint,
  periodKey,
  periodLabel,
  periodSequence,
  type PeriodGroup,
} from "@/lib/constants/receipt-report";

/**
 * Tope de encabezados que entran al reporte.
 *
 * Alto a propósito: son cinco años de recepciones de una fábrica que recibe
 * dos camiones al día. Al alcanzarlo el reporte NO se calla —devuelve
 * `truncated` y la pantalla y el Excel lo dicen—, porque un total incompleto
 * se ve exactamente igual de correcto que uno completo.
 */
const MAX_RECEIPTS = 5000;

export interface ReceiptReportInput {
  from: Date;
  to: Date;
  group: PeriodGroup;
  search?: string;
  materialId?: string;
  clientId?: string;
  supplierId?: string;
  carrierId?: string;
}

export interface ReceiptReportSummary {
  /** El rango efectivo. La hoja exportada tiene que declararlo. */
  from: Date;
  to: Date;
  receipts: number;
  lots: number;
  byUnit: UnitTotal[];
  materials: number;
  clients: number;
}

export interface ReceiptReportData {
  summary: ReceiptReportSummary;
  /** En orden cronológico, no por cantidad: es una serie de tiempo. */
  periods: ReportGroupRow[];
  byMaterial: ReportGroupRow[];
  byClient: ReportGroupRow[];
  bySupplier: ReportGroupRow[];
  byCarrier: ReportGroupRow[];
  /** Una guía por renglón: el respaldo de todas las cifras de arriba. */
  detail: ReceiptCardData[];
  truncated: boolean;
}

/**
 * El reporte global de recepciones: cuánto entró, cuándo, de qué y de quién.
 *
 * No extiende `BaseService` por lo mismo que `ReportService`: sólo lee. No
 * genera folios, no abre transacciones y no audita, así que arrastrar esa
 * maquinaria sería peso muerto.
 *
 * Todo se mide con `initialQuantity` —lo que se bajó del camión— y nunca con
 * el saldo de hoy. Si se usara el saldo, un mes viejo iría encogiendo cada vez
 * que se corta un rollo, y "en marzo llegaron 4,000 m" dejaría de ser cierto
 * a la semana siguiente.
 */
export class ReceiptReportService {
  async getReport(input: ReceiptReportInput): Promise<ReceiptReportData> {
    const data = await new ReceiptRepository().findReportData(
      {
        from: input.from,
        to: input.to,
        search: input.search,
        materialId: input.materialId,
        clientId: input.clientId,
        supplierId: input.supplierId,
        carrierId: input.carrierId,
      },
      MAX_RECEIPTS,
    );

    const periods = this.buildPeriods(data.receipts, input);

    const bySupplier = this.groupByHeader(data.receipts, (receipt) => ({
      key: receipt.supplier?.id ?? "__none__",
      // "Sin proveedor" y no un renglón omitido: la tela que llega sin guía de
      // proveedor existe, y sacarla del corte descuadraría el total.
      label: receipt.supplier?.name ?? "Sin proveedor",
    }));

    const byCarrier = this.groupByHeader(data.receipts, (receipt) => ({
      key: receipt.carrier?.id ?? "__none__",
      label: receipt.carrier?.name ?? "Sin paquetería",
    }));

    return {
      summary: this.buildSummary(data, input),
      periods,
      byMaterial: sortGroups(data.byMaterial.map(round)),
      byClient: sortGroups(data.byClient.map(round)),
      bySupplier,
      byCarrier,
      detail: data.receipts,
      truncated: data.truncated,
    };
  }

  /**
   * La serie de tiempo.
   *
   * Los periodos vacíos se siembran con ceros en vez de desaparecer: una
   * gráfica que salta de marzo a agosto hace ver el almacén como si hubiera
   * recibido parejo todo el año, cuando lo que pasó fue que estuvo cuatro
   * meses sin recibir nada. Ese hueco es justo el dato.
   */
  private buildPeriods(
    receipts: ReceiptCardData[],
    input: ReceiptReportInput,
  ): ReportGroupRow[] {
    const buckets = new Map<string, ReportGroupRow>();

    for (const key of periodSequence(input.from, input.to, input.group)) {
      buckets.set(key, this.emptyPeriod(key, input.group));
    }

    for (const receipt of receipts) {
      const key = periodKey(receipt.date, input.group);
      const bucket = buckets.get(key) ?? this.emptyPeriod(key, input.group);

      addReceipt(bucket, receipt);
      buckets.set(key, bucket);
    }

    // Cronológico, del más viejo al más nuevo. Las claves están hechas para
    // ordenarse como texto ("2026-08" < "2026-09"), sin volver a parsear fechas.
    return [...buckets.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(round);
  }

  private emptyPeriod(key: string, group: PeriodGroup): ReportGroupRow {
    return {
      key,
      label: periodLabel(key, group),
      hint: periodHint(key, group),
      lots: 0,
      receipts: 0,
      byUnit: [],
    };
  }

  /** Cortes que salen del ENCABEZADO de la guía: proveedor y paquetería. */
  private groupByHeader(
    receipts: ReceiptCardData[],
    classify: (receipt: ReceiptCardData) => { key: string; label: string },
  ): ReportGroupRow[] {
    const buckets = new Map<string, ReportGroupRow>();

    for (const receipt of receipts) {
      const { key, label } = classify(receipt);
      const bucket = buckets.get(key) ?? {
        key,
        label,
        hint: "",
        lots: 0,
        receipts: 0,
        byUnit: [],
      };

      addReceipt(bucket, receipt);
      buckets.set(key, bucket);
    }

    return sortGroups([...buckets.values()].map(round));
  }

  private buildSummary(
    data: { receipts: ReceiptCardData[]; byMaterial: ReportGroupRow[]; byClient: ReportGroupRow[] },
    input: ReceiptReportInput,
  ): ReceiptReportSummary {
    const total: ReportGroupRow = {
      key: "__total__",
      label: "Total",
      hint: "",
      lots: 0,
      receipts: 0,
      byUnit: [],
    };

    for (const receipt of data.receipts) addReceipt(total, receipt);
    // `sortGroups` deja las unidades de mayor a menor: la primera es la que se
    // pinta grande arriba y con la que se miden las barras de los desgloses.
    sortGroups([round(total)]);

    return {
      from: input.from,
      to: input.to,
      receipts: total.receipts ?? 0,
      lots: total.lots,
      byUnit: total.byUnit,
      materials: data.byMaterial.length,
      clients: data.byClient.length,
    };
  }
}

/** Suma una guía a un renglón de corte, unidad por unidad. */
function addReceipt(bucket: ReportGroupRow, receipt: ReceiptCardData): void {
  bucket.receipts = (bucket.receipts ?? 0) + 1;

  for (const total of receipt.byUnit) {
    const existing = bucket.byUnit.find((item) => item.unit === total.unit);

    if (existing) {
      existing.quantity += total.quantity;
      existing.lots += total.lots;
      continue;
    }

    bucket.byUnit.push({ ...total });
  }

  bucket.lots += receipt.byUnit.reduce((sum, total) => sum + total.lots, 0);
}

/**
 * Redondea a los 4 decimales que guarda la base.
 *
 * Sumar decimales en punto flotante deja colas: 5,501.9999999999 en vez de
 * 5,502. La pantalla lo esconde al formatear a dos decimales, pero el Excel
 * manda el número crudo y ahí la cola sí se ve.
 */
function round(row: ReportGroupRow): ReportGroupRow {
  for (const total of row.byUnit) {
    total.quantity = Math.round(total.quantity * 10_000) / 10_000;
  }
  return row;
}
