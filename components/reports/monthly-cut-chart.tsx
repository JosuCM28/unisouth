import type { MonthlyCutRow } from "@/lib/reports/cut-report-calculations";
import { formatChange } from "@/lib/reports/cut-report-format";
import { formatQuantity } from "@/lib/utils";
import { VerticalBars } from "./vertical-bars";

/** Seis meses que terminan en el del periodo, para ver la tendencia. */
export function MonthlyCutChart({ rows }: { rows: MonthlyCutRow[] }) {
  if (rows.every((row) => row.pieces === 0)) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin corte registrado en estos meses.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <VerticalBars
        data={rows.map((row) => ({
          key: row.key,
          value: row.pieces,
          caption: monthCaption(row),
        }))}
      />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-1 pr-3 font-medium">Mes</th>
            <th className="py-1 pr-3 text-right font-medium">Piezas</th>
            <th className="py-1 pr-3 text-right font-medium">Var.</th>
            <th className="py-1 text-right font-medium">Metros</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border">
              <td className="py-1 pr-3">{monthCaption(row)}</td>
              <td className="tabular py-1 pr-3 text-right">
                {formatQuantity(row.pieces)}
              </td>
              <td className="tabular py-1 pr-3 text-right">
                {formatChange(row.change)}
              </td>
              <td className="tabular py-1 text-right">
                {/* Sin metros anotados se deja el guion: cero sería un dato. */}
                {formatQuantity(row.meters || null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.some((row) => row.partial) && (
        <p className="text-xs text-muted-foreground">
          * Mes incompleto: todavía no se compara parejo con los demás.
        </p>
      )}
    </div>
  );
}

function monthCaption(row: MonthlyCutRow): string {
  return row.partial ? `${row.label}*` : row.label;
}
