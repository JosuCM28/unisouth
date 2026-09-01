import { cutBatchLabel } from "@/lib/constants/labels";
import { formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Lo que una talla aportó a un corte. */
export interface BatchEntryView {
  id: string;
  sizeCode: string;
  quantity: number;
  createdAt: Date;
  userName: string | null;
  notes: string | null;
}

export interface BatchView {
  id: string;
  number: number;
  label: string | null;
  notes: string | null;
  openedAt: Date;
  openedByName: string | null;
  entries: BatchEntryView[];
}

/**
 * Los cortes de una orden, del más nuevo al más viejo.
 *
 * Sustituye al historial plano de avances, que respondía "cuándo se cortó
 * esto" pero no "cuántas dio el segundo corte": las entradas se veían en fila
 * y agrupar las de una misma tanda era trabajo de quien leía. Aquí cada corte
 * trae su total y su desglose por talla, que es como se pregunta en el piso.
 *
 * Las tallas de un corte se AGRUPAN aunque se hayan capturado en dos ratos:
 * un corte es un tendido, no una sesión de captura, y ver la 32 dos veces en
 * el mismo bloque obliga a sumarlas a mano.
 */
export function OrderBatches({ batches }: { batches: BatchView[] }) {
  if (batches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no se captura ningún corte. Usa “Capturar corte” cuando el tendido
        salga de la mesa.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {batches.map((batch) => {
        const total = batch.entries.reduce(
          (sum, entry) => sum + entry.quantity,
          0,
        );

        return (
          <li key={batch.id} className="flat-surface flex flex-col gap-2 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {cutBatchLabel(batch.number, batch.label)}
                </p>
                <p className="tabular text-xs text-muted-foreground">
                  {formatDate(batch.openedAt)}
                  {batch.openedByName && ` · ${batch.openedByName}`}
                </p>
                {batch.notes && (
                  <p className="text-xs text-muted-foreground">{batch.notes}</p>
                )}
              </div>

              <p className="tabular shrink-0 text-2xl font-semibold leading-none">
                {total}
              </p>
            </div>

            {batch.entries.length === 0 ? (
              /* Un corte abierto sin piezas es un estado válido: se abrió para
                 empezar a capturar y todavía no sale nada de la mesa. */
              <p className="text-xs text-muted-foreground">
                Abierto, sin piezas capturadas.
              </p>
            ) : (
              <ul className="flex flex-col">
                {groupBySize(batch.entries).map((row) => (
                  <li
                    key={row.sizeCode}
                    className="flex items-baseline justify-between gap-3 border-t border-border py-1 text-sm"
                  >
                    <span className="tabular">Talla {row.sizeCode}</span>
                    <span
                      className={cn(
                        "tabular font-medium",
                        row.quantity < 0 && "text-state-defective",
                      )}
                    >
                      {row.quantity > 0 ? "+" : ""}
                      {row.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* El detalle de captura queda plegado: interesa cuando algo no
                cuadra, no cada vez que se abre la orden. */}
            {batch.entries.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="touch-target cursor-pointer list-none py-1">
                  Ver las {batch.entries.length}{" "}
                  {batch.entries.length === 1 ? "captura" : "capturas"}
                </summary>
                <ul className="mt-1 flex flex-col gap-1 border-t border-border pt-1">
                  {batch.entries.map((entry) => (
                    <li key={entry.id} className="tabular">
                      Talla {entry.sizeCode}: {entry.quantity > 0 ? "+" : ""}
                      {entry.quantity} · {formatDateTime(entry.createdAt)}
                      {entry.userName && ` · ${entry.userName}`}
                      {entry.notes && ` · ${entry.notes}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Suma las capturas de una misma talla dentro del corte. */
function groupBySize(entries: BatchEntryView[]) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    totals.set(entry.sizeCode, (totals.get(entry.sizeCode) ?? 0) + entry.quantity);
  }

  return [...totals.entries()]
    .map(([sizeCode, quantity]) => ({ sizeCode, quantity }))
    .sort((a, b) => a.sizeCode.localeCompare(b.sizeCode, "es", { numeric: true }));
}
