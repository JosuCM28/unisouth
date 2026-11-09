import { CUT_DETAIL_GROUP_LABELS } from "@/lib/constants/labels";
import { formatDayKey } from "@/lib/report-period";
import type {
  CutDetailBucket,
  CutDetailData,
  CutDetailItem,
} from "@/lib/reports/cut-detail-calculations";
import { header, number, percent, text } from "./cut-summary-sheet";
import { toXlsxDocument, type SheetRow } from "./xlsx";

/**
 * El Excel del detalle de corte: el resumen por periodo y, debajo, lo que se
 * cortó en cada uno.
 *
 * Las columnas de cifras van pegadas a la izquierda porque los dos bloques
 * comparten hoja y anchos: así las piezas caen en la misma columna arriba y
 * abajo, y se pueden seguir con el dedo.
 */
const WIDTHS = [30, 11, 11, 18, 24, 28, 14, 44, 24];

function section(title: string): SheetRow[] {
  return [[], [{ value: title, style: "section", mergeTo: WIDTHS.length }]];
}

function labelOf(bucket: CutDetailBucket): string {
  return bucket.partial ? `${bucket.label} (incompleto)` : bucket.label;
}

function summaryRows({ buckets, totals }: CutDetailData): SheetRow[] {
  return [
    ...section("Resumen"),
    header(["Periodo", "Piezas", "Bultos", "Órdenes", "Cortes", "% del total", "Diferencia"]),
    ...buckets.map((bucket) => [
      text(labelOf(bucket)),
      number(bucket.pieces),
      number(bucket.bundles),
      number(bucket.orders),
      number(bucket.cuts),
      percent(bucket.share),
      number(bucket.difference),
    ]),
    [
      { value: "Total", style: "total" },
      { value: totals.pieces, kind: "number", style: "totalNumber" },
      { value: totals.bundles, kind: "number", style: "totalNumber" },
      { value: totals.orders, kind: "number", style: "totalNumber" },
      { value: totals.cuts, kind: "number", style: "totalNumber" },
    ],
  ];
}

function sizesText(item: CutDetailItem): string {
  return item.sizes.map((size) => `${size.code}: ${size.pieces}`).join(" · ");
}

function itemRow(item: CutDetailItem): SheetRow {
  return [
    text(formatDayKey(item.dayKey)),
    number(item.pieces),
    number(item.bundles),
    text(item.orderCode),
    text(item.clientName),
    text(item.description),
    text(item.cutName),
    text(sizesText(item)),
    text(item.capturedBy),
  ];
}

function bucketRows(bucket: CutDetailBucket): SheetRow[] {
  if (bucket.cuts === 0) return [];

  return [
    ...section(labelOf(bucket)),
    header(["Día", "Piezas", "Bultos", "Folio", "Empresa", "Prenda", "Corte", "Tallas", "Capturó"]),
    ...bucket.items.map(itemRow),
  ];
}

export function buildCutDetailWorkbook(report: CutDetailData): Buffer {
  const { period, group, buckets } = report;

  const rows: SheetRow[] = [
    [{ value: "DETALLE DE CORTE", style: "title" }],
    [{ value: "Periodo", style: "label" }, text(period.label)],
    [{ value: "Agrupado", style: "label" }, text(CUT_DETAIL_GROUP_LABELS[group])],
    ...summaryRows(report),
    ...buckets.flatMap(bucketRows),
  ];

  return toXlsxDocument(rows, WIDTHS, "Detalle de corte", {
    landscape: true,
    fitToWidth: true,
  });
}
