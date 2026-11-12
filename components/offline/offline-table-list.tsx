import { Loader2 } from "lucide-react";
import type { OfflineTable } from "@/lib/constants/offline-tables";
import { OFFLINE_TABLE_LABELS } from "@/lib/constants/labels";
import type { OfflineTableMeta } from "@/lib/offline/snapshot.types";
import { formatDateTime, formatQuantity } from "@/lib/utils";

/**
 * Qué hay guardado en el equipo, tabla por tabla.
 *
 * Renglones apilados y no una tabla: en el celular una tabla de tres
 * columnas ya obliga a barrer de lado, y aquí basta con nombre, cuántos y
 * de cuándo.
 */
export function OfflineTableList({
  tables,
  meta,
  downloading,
}: {
  tables: OfflineTable[];
  meta: Map<OfflineTable, OfflineTableMeta>;
  /** La tabla que se está bajando en este momento, si hay descarga. */
  downloading: OfflineTable | null;
}) {
  return (
    <ul className="flat-surface divide-y divide-border">
      {tables.map((table) => (
        <OfflineTableRow
          key={table}
          table={table}
          meta={meta.get(table)}
          isDownloading={downloading === table}
        />
      ))}
    </ul>
  );
}

function OfflineTableRow({
  table,
  meta,
  isDownloading,
}: {
  table: OfflineTable;
  meta: OfflineTableMeta | undefined;
  isDownloading: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{OFFLINE_TABLE_LABELS[table]}</p>
        <p className="tabular text-xs text-muted-foreground">
          {downloadedLabel(meta)}
        </p>
      </div>

      {isDownloading && (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-label="Descargando"
        />
      )}

      {!isDownloading && (
        <span className="tabular shrink-0 text-sm">
          {meta ? formatQuantity(meta.count, { decimals: 0 }) : "—"}
        </span>
      )}
    </li>
  );
}

function downloadedLabel(meta: OfflineTableMeta | undefined): string {
  if (!meta) return "Sin copia en este equipo";
  return `Copia del ${formatDateTime(meta.downloadedAt)}`;
}
