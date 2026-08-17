import { ArrowDownLeft, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  MOVEMENT_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import type { RecentMovement } from "@/lib/services/dashboard.service";
import { cn, formatDateTime, formatQuantity } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import type { MovementType, Unit } from "@prisma/client";

interface DirectionStyle {
  icon: LucideIcon;
  className: string;
}

/**
 * El signo de la cantidad ya dice la dirección: positivo entra, negativo sale,
 * cero es un traspaso que no toca el saldo. Se resuelve con salidas tempranas
 * en vez de ternarias encadenadas.
 */
function directionIcon(quantity: number): DirectionStyle {
  if (quantity > 0) {
    return { icon: ArrowDownLeft, className: "text-state-available" };
  }
  if (quantity < 0) {
    return { icon: ArrowUpRight, className: "text-state-defective" };
  }
  return { icon: Minus, className: "text-muted-foreground" };
}

interface RecentMovementsProps {
  movements: RecentMovement[];
}

export function RecentMovements({ movements }: RecentMovementsProps) {
  if (movements.length === 0) {
    return (
      <EmptyState
        title="Sin movimientos todavía"
        description="Cuando registres la primera entrada aparecerá aquí."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {movements.map((movement) => {
        const { icon: Icon, className } = directionIcon(movement.quantity);
        const unitLabel = UNIT_SHORT_LABELS[movement.unit as Unit] ?? movement.unit;

        return (
          <li key={movement.id} className="flex items-start gap-3 py-3">
            <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-hidden />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {MOVEMENT_TYPE_LABELS[movement.type as MovementType] ??
                  movement.type}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                <span className="tabular">{movement.lotCode}</span> ·{" "}
                {movement.materialName}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDateTime(movement.createdAt)}
                {movement.userName && ` · ${movement.userName}`}
              </p>
            </div>

            <span className={cn("tabular shrink-0 text-sm font-medium", className)}>
              {movement.quantity > 0 && "+"}
              {formatQuantity(movement.quantity, { unit: unitLabel })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
