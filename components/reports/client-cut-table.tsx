import type { ClientCutRow } from "@/lib/reports/cut-report-calculations";
import { formatRate } from "@/lib/reports/cut-report-format";
import { formatQuantity } from "@/lib/utils";

/**
 * Quién se llevó la mesa en el periodo.
 *
 * Una lista con barra y no una tabla: sirve igual en celular que en escritorio
 * y la barra deja ver de un vistazo qué tanto pesa cada empresa.
 */
export function ClientCutTable({ rows }: { rows: ClientCutRow[] }) {
  const top = rows[0];

  if (!top) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin corte registrado en el periodo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-border p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          La que más corte tuvo
        </p>
        <p className="mt-1 break-words text-base font-semibold">{top.name}</p>
        <p className="tabular text-sm">
          {formatQuantity(top.pieces)} piezas · {formatRate(top.share)} del total
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <ClientRow key={row.key} row={row} max={top.pieces} />
        ))}
      </ul>
    </div>
  );
}

function ClientRow({ row, max }: { row: ClientCutRow; max: number }) {
  const width = max > 0 ? Math.max(0, row.pieces / max) * 100 : 0;

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 break-words font-medium">{row.name}</span>
        <span className="tabular shrink-0 font-medium">
          {formatQuantity(row.pieces)} · {formatRate(row.share)}
        </span>
      </div>
      <div className="h-2 w-full border border-border bg-muted" aria-hidden>
        <div className="h-full bg-primary" style={{ width: `${width}%` }} />
      </div>
      <p className="tabular text-xs text-muted-foreground">
        {row.orders} {row.orders === 1 ? "orden" : "órdenes"} · pedido{" "}
        {formatQuantity(row.ordered)} · cortado {formatQuantity(row.cut)} ·
        avance {formatRate(row.progress)}
      </p>
    </li>
  );
}
