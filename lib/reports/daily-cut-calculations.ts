import {
  formatDayKey,
  weekdayShort,
  type ReportPeriod,
} from "@/lib/report-period";
import type {
  CutDetailData,
  CutDetailItem,
} from "@/lib/reports/cut-detail-calculations";

/**
 * Las cuentas de "Lo cortado": lo capturado en la mesa en un día o rango,
 * con UNA COLUMNA POR TALLA.
 *
 * Sale del mismo detalle de corte que Reportes —misma regla de qué día cuenta
 * cada bulto— y sólo lo voltea a rejilla. Así las dos pantallas nunca dan
 * cifras distintas para el mismo día.
 */

export interface DailyCutRow {
  id: string;
  orderCode: string;
  clientName: string;
  description: string;
  cutName: string;
  capturedBy: string;
  bundles: number;
  pieces: number;
  /** Piezas por código de talla. Una talla que no se cortó no aparece. */
  sizes: Record<string, number>;
}

export interface DailyCutTotals {
  /** Sólo las tallas que traen algo, en el orden de la escala. */
  sizeCodes: string[];
  sizes: Record<string, number>;
  bundles: number;
  pieces: number;
  orders: number;
}

export interface DailyCutDay extends DailyCutTotals {
  key: string;
  label: string;
  rows: DailyCutRow[];
}

export interface DailyCutReport {
  fromKey: string;
  toKey: string;
  label: string;
  days: DailyCutDay[];
  totals: DailyCutTotals;
}

/** Un día solo se nombra por su día; un rango, por sus dos puntas. */
export function dailyCutLabel(fromKey: string, toKey: string): string {
  if (fromKey === toKey) return `${weekdayShort(fromKey)} ${formatDayKey(fromKey)}`;
  return `${formatDayKey(fromKey)} – ${formatDayKey(toKey)}`;
}

/**
 * `sizeOrder` es la posición de cada código en la escala del catálogo: sin
 * ella las columnas saldrían en el orden en que se encontraron (G antes que
 * CH) y el jefe leería tallas brincadas.
 */
export function buildDailyCut(
  detail: CutDetailData,
  period: ReportPeriod,
  sizeOrder: Map<string, number>,
): DailyCutReport {
  const days = detail.buckets
    .filter((bucket) => bucket.cuts > 0)
    .map((bucket) => {
      const rows = bucket.items.map(toRow);
      return { key: bucket.key, label: bucket.label, rows, ...totalsOf(rows, sizeOrder) };
    });

  return {
    fromKey: period.fromKey,
    toKey: period.toKey,
    label: dailyCutLabel(period.fromKey, period.toKey),
    days,
    totals: totalsOf(days.flatMap((day) => day.rows), sizeOrder),
  };
}

function toRow(item: CutDetailItem): DailyCutRow {
  return {
    id: item.id,
    orderCode: item.orderCode,
    clientName: item.clientName,
    description: item.description,
    cutName: item.cutName,
    capturedBy: item.capturedBy,
    bundles: item.bundles,
    pieces: item.pieces,
    sizes: Object.fromEntries(item.sizes.map((size) => [size.code, size.pieces])),
  };
}

function totalsOf(rows: DailyCutRow[], sizeOrder: Map<string, number>): DailyCutTotals {
  const sizes: Record<string, number> = {};
  for (const row of rows) {
    for (const [code, pieces] of Object.entries(row.sizes)) {
      sizes[code] = (sizes[code] ?? 0) + pieces;
    }
  }

  return {
    sizeCodes: sortSizeCodes(Object.keys(sizes), sizeOrder),
    sizes,
    bundles: rows.reduce((total, row) => total + row.bundles, 0),
    pieces: rows.reduce((total, row) => total + row.pieces, 0),
    // Una orden con dos cortes el mismo día sigue siendo UNA orden.
    orders: new Set(rows.map((row) => row.orderCode)).size,
  };
}

function sortSizeCodes(codes: string[], sizeOrder: Map<string, number>): string[] {
  const position = (code: string) => sizeOrder.get(code) ?? Number.MAX_SAFE_INTEGER;
  return [...codes].sort((a, b) => position(a) - position(b) || a.localeCompare(b));
}
