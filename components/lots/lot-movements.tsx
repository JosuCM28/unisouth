import { ArrowDownLeft, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MovementType, Unit } from "@prisma/client";
import { MOVEMENT_TYPE_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { cn, formatDateTime, formatQuantity } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

export interface MovementRow {
  id: string;
  code: string;
  type: MovementType;
  quantity: number;
  unit: Unit;
  balanceAfter: number;
  reason: string | null;
  userName: string | null;
  createdAt: Date;
}

/** El signo de la cantidad ya dice la dirección; sin ternarias anidadas. */
function directionStyle(quantity: number): { icon: LucideIcon; className: string } {
  if (quantity > 0) return { icon: ArrowDownLeft, className: "text-state-available" };
  if (quantity < 0) return { icon: ArrowUpRight, className: "text-destructive" };
  return { icon: Minus, className: "text-muted-foreground" };
}

/**
 * El kárdex del rollo: qué le ha pasado, en orden.
 *
 * Es append-only: nunca se edita ni se borra un renglón. Una corrección es
 * OTRO movimiento de ajuste con su motivo.
 */
export function LotMovements({ movements }: { movements: MovementRow[] }) {
  if (movements.length === 0) {
    return <EmptyState title="Sin movimientos" description="Este rollo no tiene kárdex todavía." />;
  }

  return (
    <ul className="divide-y divide-border">
      {movements.map((movement) => {
        const { icon: Icon, className } = directionStyle(movement.quantity);
        const unitLabel = UNIT_SHORT_LABELS[movement.unit];

        return (
          <li key={movement.id} className="flex items-start gap-3 py-3">
            <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-hidden />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {MOVEMENT_TYPE_LABELS[movement.type]}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(movement.createdAt)}
                {movement.userName && ` · ${movement.userName}`}
              </p>
              {movement.reason && (
                <p className="mt-0.5 text-xs italic text-muted-foreground">
                  {movement.reason}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className={cn("tabular text-sm font-medium", className)}>
                {movement.quantity > 0 && "+"}
                {formatQuantity(movement.quantity, { unit: unitLabel })}
              </p>
              <p className="tabular text-xs text-muted-foreground">
                saldo {formatQuantity(movement.balanceAfter)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
