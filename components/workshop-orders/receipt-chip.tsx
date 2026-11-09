import {
  WORKSHOP_DELIVERY_STATE_LABELS,
  WORKSHOP_DELIVERY_STATE_STYLES,
} from "@/lib/constants/labels";
import { cn, formatDate } from "@/lib/utils";
import type { DeliveryReceipt } from "@/lib/workshop-delivery";

/** Lo que la casa lee de una entrega: si ya llegó al taller, y quién lo dijo. */
export function ReceiptChip({ receipt }: { receipt: DeliveryReceipt }) {
  const detail = receipt.receivedAt
    ? ` el ${formatDate(receipt.receivedAt)}${receipt.receivedByName ? ` por ${receipt.receivedByName}` : ""}`
    : "";

  return (
    <span
      className={cn(
        "tabular rounded px-1.5 py-0.5 text-xs",
        WORKSHOP_DELIVERY_STATE_STYLES[receipt.state],
      )}
    >
      {WORKSHOP_DELIVERY_STATE_LABELS[receipt.state]}
      {receipt.state === "RECEIVED" && detail}
    </span>
  );
}
