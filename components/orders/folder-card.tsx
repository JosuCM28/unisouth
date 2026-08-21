import Link from "next/link";
import { Archive, FolderOpen } from "lucide-react";
import type { OrderFolderWithTotals } from "@/lib/repositories/order-folder.repository";
import { cn, cutProgress, formatDate } from "@/lib/utils";

interface Props {
  folder: OrderFolderWithTotals;
}

/**
 * Una carpeta de pedido en la lista.
 *
 * Muestra lo mismo que una orden —cuánto falta— pero sumando todas las suyas,
 * para que "cómo va el pedido de Ternium" se responda sin abrir nada.
 */
export function FolderCard({ folder }: Props) {
  const { pending, surplus } = cutProgress(
    folder.orderedQuantity,
    folder.cutQuantity,
  );
  const isArchived = Boolean(folder.archivedAt);
  const late = isLate(folder.dueDate, pending);

  return (
    <Link
      href={`/orders/folders/${folder.id}`}
      className={cn(
        "flat-surface flex items-start justify-between gap-3 p-3 transition-colors active:bg-accent",
        // La carpeta archivada se apaga en vez de esconderse: sigue ahí para
        // consultarse, pero no compite con lo que sí hay que cortar.
        isArchived && "opacity-60",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {isArchived ? (
            <Archive className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <FolderOpen className="size-4 shrink-0 text-primary" aria-hidden />
          )}
          <span className="tabular text-sm font-medium">{folder.code}</span>
          {isArchived && (
            <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              Archivado
            </span>
          )}
        </div>

        <p className="truncate text-sm font-medium">{folder.name}</p>

        <p className="truncate text-xs text-muted-foreground">
          {folder.client?.name ?? "Sin cliente"}
          {` · ${folder.orderCount} ${folder.orderCount === 1 ? "orden" : "órdenes"}`}
          {folder.completedCount > 0 &&
            ` · ${folder.completedCount} ${folder.completedCount === 1 ? "lista" : "listas"}`}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {folder.reference && (
            <span className="tabular rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              Ref. {folder.reference}
            </span>
          )}

          {folder.dueDate && (
            <span
              className={cn(
                "tabular rounded border px-1.5 py-0.5 text-xs",
                late
                  ? "border-state-defective text-state-defective"
                  : "border-border text-muted-foreground",
              )}
            >
              Entrega {formatDate(folder.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Sin órdenes todavía no hay nada que sumar: un "0 de 0" haría creer
          que el pedido está terminado cuando ni siquiera ha empezado. */}
      <div className="shrink-0 text-right">
        {folder.orderCount === 0 ? (
          <p className="text-xs text-muted-foreground">Sin órdenes</p>
        ) : (
          <>
            <p
              className={cn(
                "tabular text-lg font-bold leading-none",
                surplus > 0 && "text-state-remnant",
              )}
            >
              {surplus > 0 ? `+${surplus}` : pending}
            </p>
            <p className="tabular text-xs text-muted-foreground">
              {surplus > 0 ? "sobran" : `de ${folder.orderedQuantity}`}
            </p>
            <p className="tabular mt-0.5 text-xs text-muted-foreground">
              {folder.cutQuantity} cortadas
            </p>
          </>
        )}
      </div>
    </Link>
  );
}

/**
 * ¿Se pasó la entrega con trabajo pendiente?
 *
 * Misma regla que en las órdenes: un pedido entregado tarde pero ya terminado
 * no lleva alarma, o el rojo dejaría de significar "hay que correr".
 */
function isLate(dueDate: Date | null, pending: number): boolean {
  if (!dueDate) return false;
  return pending > 0 && dueDate.getTime() < Date.now();
}
