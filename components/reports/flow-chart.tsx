import type { FlowRow } from "@/lib/services/report.service";
import { formatQuantity } from "@/lib/utils";

/**
 * Entradas contra salidas, mes a mes.
 *
 * Dos barras por mes, una junto a otra: comparar "cuánto entró" con "cuánto
 * salió" es la lectura completa. Una sola barra con el saldo neto escondería
 * que un mes movió mucho en ambas direcciones.
 *
 * En celular se hace scroll horizontal dentro de su propia caja, nunca la
 * página: seis meses no caben en 375px sin apretar los números.
 */
export function FlowChart({ data }: { data: FlowRow[] }) {
  const max = Math.max(
    1,
    ...data.map((row) => Math.max(row.inbound, row.outbound)),
  );

  const hasMovement = data.some((row) => row.inbound > 0 || row.outbound > 0);

  if (!hasMovement) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin movimientos registrados en los últimos meses.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 text-xs">
        <Legend className="bg-state-available" label="Entró" />
        <Legend className="bg-primary" label="Salió" />
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max items-end gap-4 pb-1">
          {data.map((row) => (
            <div key={row.month} className="flex w-16 flex-col items-center gap-1">
              <div className="flex h-32 items-end gap-1" aria-hidden>
                <Bar value={row.inbound} max={max} className="bg-state-available" />
                <Bar value={row.outbound} max={max} className="bg-primary" />
              </div>

              <span className="text-xs text-muted-foreground">{row.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* La tabla lleva los números exactos y es lo que leen los lectores de
          pantalla: la gráfica de arriba es sólo la forma. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-1 pr-4 font-medium">Mes</th>
              <th className="py-1 pr-4 text-right font-medium">Entró</th>
              <th className="py-1 text-right font-medium">Salió</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.month} className="border-b border-border">
                <td className="py-1 pr-4">{row.label}</td>
                <td className="tabular py-1 pr-4 text-right">
                  {formatQuantity(row.inbound)}
                </td>
                <td className="tabular py-1 text-right">
                  {formatQuantity(row.outbound)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Bar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className: string;
}) {
  // Un mínimo de 2px para que un mes con poco movimiento no desaparezca del
  // todo y se confunda con un mes en cero.
  const height = value > 0 ? Math.max(2, (value / max) * 100) : 0;

  return (
    <div
      className={`w-5 ${className}`}
      style={{ height: `${height}%` }}
    />
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3 border border-border ${className}`} aria-hidden />
      {label}
    </span>
  );
}
