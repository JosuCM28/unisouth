import type { StockByClient as StockByClientData } from "@/lib/services/dashboard.service";
import { formatQuantity } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

interface StockByClientProps {
  data: StockByClientData[];
}

/**
 * Existencias por dueño, en barras planas.
 *
 * Las barras son proporcionales al mayor, no al total: con un cliente que
 * concentra el 90% del material, las demás barras quedarían invisibles.
 */
export function StockByClient({ data }: StockByClientProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sin existencias"
        description="Da de alta el primer rollo para ver el reparto por cliente."
      />
    );
  }

  const maxQuantity = Math.max(...data.map((row) => row.quantity), 1);

  return (
    <ul className="flex flex-col gap-3">
      {data.map((row) => (
        <li key={row.clientId ?? "sin-asignar"}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{row.clientName}</span>
            <span className="tabular shrink-0 text-sm text-muted-foreground">
              {formatQuantity(row.quantity)}
            </span>
          </div>

          <div className="mt-1.5 h-2 w-full bg-secondary">
            <div
              className="h-full bg-primary"
              style={{ width: `${(row.quantity / maxQuantity) * 100}%` }}
              // El ancho es decorativo: el dato exacto ya está en el texto.
              aria-hidden
            />
          </div>

          <p className="tabular mt-1 text-xs text-muted-foreground">
            {row.lots} {row.lots === 1 ? "rollo" : "rollos"}
          </p>
        </li>
      ))}
    </ul>
  );
}
