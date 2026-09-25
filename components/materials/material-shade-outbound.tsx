import { Palette } from "lucide-react";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import type { MaterialOutboundByShade } from "@/lib/material-history";
import { formatQuantity } from "@/lib/utils";

/**
 * Cuánto salió de cada tono en la ventana elegida arriba.
 *
 * Usa la MISMA ventana que los KPIs (Hoy · 7 días · Mes · Año o el rango a
 * mano): si tuviera su propio selector, la suma de los tonos podría no
 * cuadrar con la tarjeta de "Salieron" que está justo encima.
 *
 * Server Component: números ya resueltos.
 */
export function MaterialShadeOutbound({
  report,
}: {
  report: MaterialOutboundByShade;
}) {
  const unitLabel = UNIT_SHORT_LABELS[report.unit];

  return (
    <section className="flat-surface p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Palette className="size-4" aria-hidden />
          Salidas por tono
        </h2>
        <p className="tabular text-xs text-muted-foreground">
          {report.documents} {report.documents === 1 ? "vale" : "vales"} de salida
        </p>
      </div>

      {report.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No salió tela en este periodo.
        </p>
      ) : (
        <ul className="flex flex-col">
          {report.rows.map((row) => (
            <li
              key={row.shade ?? ""}
              className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 text-sm last:border-b-0"
            >
              <span className="tabular min-w-0 truncate">
                {row.shade ?? "Sin tono"}
              </span>
              <span className="tabular shrink-0 text-right">
                <span className="font-semibold">
                  {formatQuantity(row.quantity, { unit: unitLabel })}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {row.lots} {row.lots === 1 ? "rollo" : "rollos"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
