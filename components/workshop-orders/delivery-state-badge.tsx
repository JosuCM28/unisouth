import {
  WORKSHOP_DELIVERY_STATE_LABELS,
  WORKSHOP_DELIVERY_STATE_STYLES,
} from "@/lib/constants/labels";
import type { WorkshopDeliveryState } from "@/lib/constants/workshop-access";
import { cn } from "@/lib/utils";

export function DeliveryStateBadge({
  state,
}: {
  state: WorkshopDeliveryState;
}) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs",
        WORKSHOP_DELIVERY_STATE_STYLES[state],
      )}
    >
      {WORKSHOP_DELIVERY_STATE_LABELS[state]}
    </span>
  );
}
