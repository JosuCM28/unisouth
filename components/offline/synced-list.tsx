import { ArrowRight } from "lucide-react";
import type { SyncedRecord } from "@/lib/offline/db";
import { QUEUE_KIND_LABELS } from "@/lib/constants/labels";
import { formatDateTime } from "@/lib/utils";

/**
 * Las capturas que ya subieron: el folio provisional que se anotó en el
 * vale y el real que le dio el servidor. Es donde se busca "¿qué folio le
 * tocó a mi TMP?".
 */
export function SyncedList({ records }: { records: SyncedRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="flat-surface px-3 py-6 text-center text-sm text-muted-foreground">
        Todavía no se ha subido nada capturado sin conexión.
      </p>
    );
  }

  return (
    <ul className="flat-surface divide-y divide-border">
      {records.map((record) => (
        <li key={record.id} className="flex flex-col gap-0.5 px-3 py-2.5">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="tabular text-muted-foreground">{record.localCode}</span>
            <ArrowRight className="size-3.5" aria-hidden />
            <span className="tabular">{record.serverCode}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {QUEUE_KIND_LABELS[record.kind]} · {record.summary}
          </p>
          <p className="tabular text-xs text-muted-foreground">
            Subida el {formatDateTime(new Date(record.syncedAt))}
          </p>
        </li>
      ))}
    </ul>
  );
}
