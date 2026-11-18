import type {
  DailyCutReport,
  DailyCutRow,
  DailyCutTotals,
} from "@/lib/reports/daily-cut-calculations";
import { toXlsxDocument, type SheetCell, type SheetRow } from "./xlsx";

/**
 * El Excel de "Lo cortado".
 *
 * Todas las secciones usan las MISMAS columnas de talla —las de todo el
 * rango—, aunque un día no haya cortado alguna: así la CH de un día cae
 * debajo de la CH del otro y se puede sumar o comparar con el dedo.
 */
const FIXED_HEAD = ["Orden", "Corte", "Empresa", "Prenda", "Capturó"];
const FIXED_WIDTHS = [16, 14, 24, 30, 18];
const SIZE_WIDTH = 7;
const NUMBER_WIDTH = 10;

const text = (value: string): SheetCell => ({ value, style: "cell" });
const number = (value: number | undefined): SheetCell => ({
  value: value ?? null,
  kind: "number",
  style: "cellNumber",
});

function headerRow(sizeCodes: string[]): SheetRow {
  return [...FIXED_HEAD, ...sizeCodes, "Bultos", "Piezas"].map((value) => ({
    value,
    style: "gridHeader",
  }));
}

function itemRow(row: DailyCutRow, sizeCodes: string[]): SheetRow {
  return [
    text(row.orderCode),
    text(row.cutName),
    text(row.clientName),
    text(row.description),
    text(row.capturedBy),
    ...sizeCodes.map((code) => number(row.sizes[code])),
    number(row.bundles),
    { value: row.pieces, kind: "number", style: "gridTotalNumber" },
  ];
}

function totalRow(label: string, totals: DailyCutTotals, sizeCodes: string[]): SheetRow {
  const total = (value: number | undefined): SheetCell => ({
    value: value ?? null,
    kind: "number",
    style: "gridTotalNumber",
  });
  return [
    { at: 1, value: label, style: "gridTotal", mergeTo: FIXED_HEAD.length },
    ...sizeCodes.map((code, index) => ({ ...total(totals.sizes[code]), at: FIXED_HEAD.length + 1 + index })),
    total(totals.bundles),
    total(totals.pieces),
  ];
}

export function buildDailyCutWorkbook(report: DailyCutReport): Buffer {
  const { sizeCodes } = report.totals;
  const width = FIXED_HEAD.length + sizeCodes.length + 2;

  const rows: SheetRow[] = [
    [{ value: "UNISOUTH · LO CORTADO", style: "title", mergeTo: width }],
    [{ value: report.label, style: "label", mergeTo: width }],
  ];

  if (report.days.length === 0) {
    rows.push([], [{ value: "No se capturó corte en estas fechas." }]);
  }

  for (const day of report.days) {
    rows.push(
      [],
      [{ value: day.label, style: "section", mergeTo: width }],
      headerRow(sizeCodes),
      ...day.rows.map((row) => itemRow(row, sizeCodes)),
      totalRow("Total del día", day, sizeCodes),
    );
  }

  if (report.days.length > 1) {
    rows.push([], totalRow("Total de las fechas", report.totals, sizeCodes));
  }

  const widths = [
    ...FIXED_WIDTHS,
    ...sizeCodes.map(() => SIZE_WIDTH),
    NUMBER_WIDTH,
    NUMBER_WIDTH,
  ];
  return toXlsxDocument(rows, widths, "Lo cortado", { landscape: true, fitToWidth: true });
}
