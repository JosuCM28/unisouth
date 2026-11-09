import {
  formatWeekdayKey,
  formatDayKey,
  weekdayShort,
} from "@/lib/report-period";
import type {
  DailyCutRow,
  DailyCutSeries,
} from "@/lib/reports/cut-report-calculations";
import { formatChange, formatDifference } from "@/lib/reports/cut-report-format";
import { cn, formatQuantity } from "@/lib/utils";
import { VerticalBars } from "./vertical-bars";

/** Las dos semanas que cierran el periodo, día por día. */
export function DailyCutChart({ data }: { data: DailyCutSeries }) {
  if (data.total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No se reportó corte en estos 14 días.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <Figure label="Estos 14 días" value={formatQuantity(data.total)} />
        <Figure
          label="14 días anteriores"
          value={formatQuantity(data.previousTotal)}
        />
        <Figure label="Variación" value={formatChange(data.change)} />
      </dl>

      <VerticalBars
        data={data.days.map((day) => ({
          key: day.key,
          value: day.pieces,
          caption: day.key.slice(8),
          subcaption: weekdayShort(day.key),
        }))}
      />

      <DailyTable days={data.days} />

      <p className="tabular text-xs text-muted-foreground">
        Del {formatDayKey(data.fromKey)} al {formatDayKey(data.toKey)}. La
        diferencia es contra el último día que hubo corte.
      </p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 text-base font-semibold">{value}</dd>
    </div>
  );
}

function DailyTable({ days }: { days: DailyCutRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="py-1 pr-4 font-medium">Día</th>
          <th className="py-1 pr-4 text-right font-medium">Piezas</th>
          <th className="py-1 text-right font-medium">Diferencia</th>
        </tr>
      </thead>
      <tbody>
        {days.map((day) => (
          <tr key={day.key} className="border-b border-border">
            <td className="tabular py-1 pr-4">{formatWeekdayKey(day.key)}</td>
            <td className="tabular py-1 pr-4 text-right">
              {pieceText(day.pieces)}
            </td>
            <td
              className={cn(
                "tabular py-1 text-right",
                differenceTone(day.difference),
              )}
            >
              {formatDifference(day.difference)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function pieceText(pieces: number): string {
  if (pieces === 0) return "Sin corte";
  return formatQuantity(pieces);
}

function differenceTone(value: number | null): string {
  if (value === null || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-state-available" : "text-state-defective";
}
