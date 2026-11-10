import { FolderOpen } from "lucide-react";
import type { OrderFolderWithTotals } from "@/lib/repositories/order-folder.repository";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { FolderCard } from "./folder-card";

interface Props {
  folders: OrderFolderWithTotals[];
  page: number;
  totalPages: number;
  total: number;
  /** Los searchParams actuales: el paginador los conserva. */
  params: Record<string, string | undefined>;
  isFiltered: boolean;
  canWrite: boolean;
}

/** La pestaña Pedidos de Órdenes: las carpetas, paginadas en el servidor. */
export function FolderList({
  folders,
  page,
  totalPages,
  total,
  params,
  isFiltered,
  canWrite,
}: Props) {
  if (folders.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={FolderOpen}
          title={isFiltered ? "Ningún pedido coincide" : "Aún no hay pedidos"}
          description={emptyDescription(isFiltered, canWrite)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {folders.map((folder) => (
          <li key={folder.id}>
            <FolderCard folder={folder} canWrite={canWrite} />
          </li>
        ))}
      </ul>
      <Pager
        page={page}
        totalPages={totalPages}
        total={total}
        itemLabel={{ one: "pedido", many: "pedidos" }}
        basePath="/orders"
        params={params}
      />
    </div>
  );
}

/**
 * A quien no puede crear pedidos no se le pide que agrupe órdenes: el botón
 * que haría falta no está en su pantalla.
 */
function emptyDescription(isFiltered: boolean, canWrite: boolean): string {
  if (isFiltered) {
    return "Prueba con otras palabras, otro cliente o incluye los archivados.";
  }
  if (!canWrite) return "Cuando se den de alta, aparecerán aquí.";
  return "Agrupa las órdenes de un mismo cliente para seguirlas juntas.";
}
