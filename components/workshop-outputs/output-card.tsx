import type { ReactNode } from "react";
import type { WorkshopOutputRow } from "@/lib/repositories/workshop-output.repository";
import { cn, formatDate, formatDateTime, formatQuantity } from "@/lib/utils";

export const PLANT_DESTINATION_LABEL = "Regresa a planta";

/** Totales de una salida: buenas y merma, ya sumadas. */
export function outputTotals(output: WorkshopOutputRow) {
  return output.lines.reduce(
    (sum, line) => ({ good: sum.good + line.quantity, scrap: sum.scrap + line.scrapQuantity }),
    { good: 0, scrap: 0 },
  );
}

/**
 * Una salida de taller, como la leen el tablero y la ficha de la orden.
 *
 * Server-friendly: no tiene estado. El botón de cancelar llega por `action`
 * porque quién puede cancelar depende de dónde se pinta.
 */
export function OutputCard({
  output,
  showOrder = false,
  showWorkshop = false,
  action,
}: {
  output: WorkshopOutputRow;
  /** En el tablero se dice de qué orden es; en la orden, sobra. */
  showOrder?: boolean;
  /** En la orden se dice qué taller la sacó; en su tablero, sobra. */
  showWorkshop?: boolean;
  action?: ReactNode;
}) {
  const totals = outputTotals(output);
  const cancelled = output.cancelledAt !== null;

  return (
    <li className={cn("flat-surface flex flex-col gap-2 p-3", cancelled && "opacity-60")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="tabular text-sm font-medium">
            {output.code}
            {cancelled && <span className="ml-2 text-xs font-normal text-destructive">Cancelada</span>}
          </p>
          {showOrder && (
            <p className="tabular text-sm">
              {output.order.reference ?? output.order.code} · {output.order.client?.name ?? "Sin cliente"}
            </p>
          )}
          <p className="text-sm">
            {showWorkshop && `${output.workshop.name} → `}
            {output.destinationWorkshop?.name ?? PLANT_DESTINATION_LABEL}
          </p>
          {output.parts && <p className="break-words text-sm">{output.parts}</p>}
          <p className="tabular text-xs text-muted-foreground">
            {formatDate(output.date)} · {formatQuantity(totals.good)} pzas
            {totals.scrap > 0 && ` · ${formatQuantity(totals.scrap)} de merma`}
          </p>
        </div>
        {!cancelled && action}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {output.lines.map((line) => (
          <li key={line.id} className="tabular">
            <span className="font-medium">{line.size.code}</span> {line.quantity}
            {line.scrapQuantity > 0 && (
              <span className="text-muted-foreground"> (−{line.scrapQuantity}: {line.scrapReason})</span>
            )}
          </li>
        ))}
      </ul>

      {output.notes && <p className="whitespace-pre-wrap text-sm">{output.notes}</p>}
      {cancelled && (
        <p className="border-t border-border pt-2 text-xs text-muted-foreground">
          Cancelada el {formatDateTime(output.cancelledAt)}: {output.cancellationReason}
        </p>
      )}
    </li>
  );
}
