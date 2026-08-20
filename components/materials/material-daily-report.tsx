import { CalendarDays } from "lucide-react";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import type { MaterialDailyReport } from "@/lib/material-history";
import { APP_TIMEZONE, formatQuantity } from "@/lib/utils";

/**
 * Qué entró y qué salió, día por día.
 *
 * Es el reporte que se coteja contra las guías del proveedor: "hoy metí 50
 * rollos de esta tela, ¿cuántos metros fueron?". Los KPIs de arriba dan el
 * total de la ventana; aquí se ve en qué día cayó cada cosa.
 *
 * Server Component: son números ya resueltos, sin estado ni eventos.
 */
export function MaterialDailyReport({
  report,
}: {
  report: MaterialDailyReport;
}) {
  const unitLabel = UNIT_SHORT_LABELS[report.unit];

  if (report.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hubo entradas ni salidas en este periodo.
      </p>
    );
  }

  return (
    <>
      {/* En celular, tarjetas apiladas: una tabla de cinco columnas con scroll
          horizontal es ilegible con una mano. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {report.rows.map((row) => (
          <li key={row.day} className="flat-surface p-3">
            <p className="tabular flex items-center gap-1.5 text-sm font-medium">
              <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden />
              {formatDay(row.day)}
            </p>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <DayFigure
                label="Entró"
                quantity={row.inQuantity}
                lots={row.inLots}
                unitLabel={unitLabel}
                tone="text-state-available"
              />
              <DayFigure
                label="Salió"
                quantity={row.outQuantity}
                lots={row.outLots}
                unitLabel={unitLabel}
                tone="text-state-defective"
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-3 font-medium">Día</th>
              <th className="py-2 pr-3 text-right font-medium">Rollos que entraron</th>
              <th className="py-2 pr-3 text-right font-medium">Metraje que entró</th>
              <th className="py-2 pr-3 text-right font-medium">Rollos que salieron</th>
              <th className="py-2 text-right font-medium">Metraje que salió</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.day} className="border-b border-border last:border-b-0">
                <td className="tabular py-2 pr-3">{formatDay(row.day)}</td>
                <td className="tabular py-2 pr-3 text-right">
                  {row.inLots || "—"}
                </td>
                <td className="tabular py-2 pr-3 text-right text-state-available">
                  {row.inQuantity > 0
                    ? formatQuantity(row.inQuantity, { unit: unitLabel })
                    : "—"}
                </td>
                <td className="tabular py-2 pr-3 text-right">
                  {row.outLots || "—"}
                </td>
                <td className="tabular py-2 text-right text-state-defective">
                  {row.outQuantity > 0
                    ? formatQuantity(row.outQuantity, { unit: unitLabel })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.truncated && (
        <p className="mt-2 text-xs text-muted-foreground">
          Se listan los {report.rows.length} días más recientes con movimiento.
          Los totales de arriba sí consideran todo el periodo.
        </p>
      )}
    </>
  );
}

interface FigureProps {
  label: string;
  quantity: number;
  lots: number;
  unitLabel: string;
  tone: string;
}

function DayFigure({ label, quantity, lots, unitLabel, tone }: FigureProps) {
  // Un día sin movimiento de ese lado se apaga en vez de pintar ceros: la
  // columna de ceros compite visualmente con la que sí trae dato.
  if (quantity === 0) {
    return (
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm text-muted-foreground">—</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`tabular text-base font-bold leading-tight ${tone}`}>
        {formatQuantity(quantity, { unit: unitLabel })}
      </p>
      <p className="tabular text-xs text-muted-foreground">
        {lots} {lots === 1 ? "rollo" : "rollos"}
      </p>
    </div>
  );
}

/**
 * "mié 19 ago". Se arma desde la clave "2026-08-19" a mediodía UTC.
 *
 * A mediodía y no a medianoche porque la clave ya viene resuelta en la zona
 * de la planta: interpretarla a las 00:00 UTC la correría al día anterior al
 * volver a formatearla con el huso de la fábrica.
 */
function formatDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);

  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: APP_TIMEZONE,
  }).format(date);
}
