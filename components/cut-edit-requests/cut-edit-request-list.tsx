import Link from "next/link";
import { LockOpen } from "lucide-react";
import type { CutEditRequestRow } from "@/lib/repositories/cut-edit-request.repository";
import {
  CUT_EDIT_REQUEST_STATUS_LABELS,
  CUT_EDIT_REQUEST_STATUS_STYLES,
} from "@/lib/constants/labels";
import { cn, formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { CutEditReviewActions } from "./cut-edit-review-actions";

/**
 * Las solicitudes, una por tarjeta: en celular es como se leen, y en
 * escritorio son pocas y caben igual de bien.
 */
export function CutEditRequestList({
  requests,
  reviewable = false,
  emptyText,
}: {
  requests: CutEditRequestRow[];
  /** Si se pintan Autorizar y Rechazar. Sólo en las pendientes. */
  reviewable?: boolean;
  emptyText: string;
}) {
  if (requests.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState icon={LockOpen} title={emptyText} />
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {requests.map((request) => (
        <li key={request.id} className="flat-surface flex flex-col gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/orders/${request.order.id}`}
              className="tabular text-sm font-semibold underline-offset-2 hover:underline"
            >
              {request.order.code}
            </Link>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs",
                CUT_EDIT_REQUEST_STATUS_STYLES[request.status],
              )}
            >
              {CUT_EDIT_REQUEST_STATUS_LABELS[request.status]}
            </span>
            {request.order.description && (
              <span className="truncate text-xs text-muted-foreground">
                {request.order.description}
              </span>
            )}
          </div>

          <p className="text-sm">{request.reason}</p>

          <p className="text-xs text-muted-foreground">
            {request.requestedBy.name} · {formatDateTime(request.createdAt)}
            {request.reviewedBy &&
              ` · contestó ${request.reviewedBy.name}`}
            {request.reviewNote && ` · "${request.reviewNote}"`}
          </p>

          {reviewable && <CutEditReviewActions requestId={request.id} />}
        </li>
      ))}
    </ul>
  );
}
