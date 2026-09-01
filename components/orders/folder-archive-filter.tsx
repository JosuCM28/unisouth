"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chip para incluir los pedidos archivados.
 *
 * Va aparte de `OrderFilters` porque ahí convive con cliente, estado y fechas,
 * que en esta pantalla no aplican: un pedido no tiene estado ni fecha de
 * corte. Montar el bloque entero sólo para reusar un chip llenaría la pantalla
 * de filtros que no filtran nada.
 */
export function FolderArchiveFilter({
  showArchived,
}: {
  showArchived: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (showArchived) params.delete("archived");
    else params.set("archived", "1");
    // Al cambiar el filtro se vuelve a la primera página: si no, queda en la
    // 3 de un resultado que ahora tiene una sola.
    params.delete("page");
    params.delete("all");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="flex">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={showArchived}
        className={cn(
          "touch-target flex shrink-0 items-center gap-1.5 rounded border px-3 text-sm transition-colors",
          showArchived
            ? "border-primary bg-primary font-medium text-primary-foreground"
            : "border-border bg-card text-muted-foreground",
        )}
      >
        <Archive className="size-3.5" aria-hidden />
        Archivados
      </button>
    </div>
  );
}
