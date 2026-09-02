import type { Unit } from "@prisma/client";
import type { ReportGroupRow } from "@/lib/repositories/receipt.repository";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatQuantity } from "@/lib/utils";

interface ReceiptReportBreakdownProps {
  rows: ReportGroupRow[];
  /**
   * La unidad con la que se dibujan las barras.
   *
   * Es la dominante de TODO el reporte, no la de cada renglón: si cada barra
   * se midiera contra su propia unidad, una caja de 8,000 botones se vería
   * más larga que 5,000 m de tela y la comparación diría lo contrario de la
   * realidad. Los renglones de otra unidad enseñan su número pero no barra.
   */
  unit: Unit | null;
  emptyLabel: string;
}

/**
 * Un corte del reporte: por tela, por cliente, por proveedor, por periodo.
 *
 * Lista y no tabla, en los dos tamaños: cada renglón es una etiqueta y sus
 * cantidades, y eso se lee igual de bien en un celular que en el escritorio.
 * La barra es la forma; el número exacto siempre está escrito al lado.
 */
export function ReceiptReportBreakdown({
  rows,
  unit,
  emptyLabel,
}: ReceiptReportBreakdownProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  // La escala la fija el renglón más grande. Todo en cero no divide entre
  // cero: se pintan las barras vacías, que es lo honesto.
  const max = Math.max(...rows.map((row) => quantityOf(row, unit)));

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">
              {row.label}
              {row.hint && (
                <span className="text-muted-foreground"> · {row.hint}</span>
              )}
            </span>

            <span className="tabular shrink-0 text-right font-medium">
              {row.byUnit.length === 0
                ? "—"
                : row.byUnit.map((total) => (
                    <span key={total.unit} className="block">
                      {formatQuantity(total.quantity, {
                        unit: UNIT_SHORT_LABELS[total.unit],
                      })}
                    </span>
                  ))}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Decorativa: el dato ya se leyó arriba en número. */}
            <div className="h-2 flex-1 border border-border bg-muted" aria-hidden>
              <div
                className="h-full bg-primary"
                style={{
                  width: `${max > 0 ? (quantityOf(row, unit) / max) * 100 : 0}%`,
                }}
              />
            </div>

            <span className="tabular shrink-0 text-xs text-muted-foreground">
              {countLabel(row)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Cuánto trae el renglón de la unidad con la que se miden las barras. */
function quantityOf(row: ReportGroupRow, unit: Unit | null): number {
  if (!unit) return 0;
  return row.byUnit.find((total) => total.unit === unit)?.quantity ?? 0;
}

/**
 * "12 rollos · 3 guías".
 *
 * Las guías sólo aparecen donde contarlas significa algo: al cortar por tela
 * una misma guía cae en varios renglones y la suma no cuadraría con el total.
 */
function countLabel(row: ReportGroupRow): string {
  const lots = `${row.lots} ${row.lots === 1 ? "rollo" : "rollos"}`;
  if (row.receipts === undefined) return lots;

  return `${lots} · ${row.receipts} ${row.receipts === 1 ? "guía" : "guías"}`;
}
