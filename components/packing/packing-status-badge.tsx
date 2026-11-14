import type { PackingOrderStatus } from "@prisma/client";
import {
  PACKING_ORDER_STATUS_LABELS,
  PACKING_ORDER_STATUS_STYLES,
} from "@/lib/constants/labels";
import { cn } from "@/lib/utils";

export function PackingStatusBadge({ status }: { status: PackingOrderStatus }) {
  return (
    <span className={cn("rounded px-1.5 text-xs font-medium", PACKING_ORDER_STATUS_STYLES[status])}>
      {PACKING_ORDER_STATUS_LABELS[status]}
    </span>
  );
}

/** Piezas de una lista de renglones de caja. */
export function sumPieces(lines: { quantity: number }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
