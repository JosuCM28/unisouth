"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, X } from "lucide-react";
import { CUTTING_ORDER_STATUS_LABELS } from "@/lib/constants/labels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/shared/search-select";
import { ExportButton } from "@/components/shared/export-button";

const STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

interface Props {
  clients: { id: string; name: string }[];
  /** Si los pedidos archivados se están mostrando. */
  showArchived?: boolean;
}

/**
 * Filtros de la lista de órdenes.
 *
 * Los filtros viven en la URL y no en estado local para que el botón de Excel
 * sea un enlace normal con los mismos parámetros: lo que se descarga es
 * exactamente lo que se está viendo, sin una segunda ruta que mantener en
 * sincronía.
 */
export function OrderFilters({ clients, showArchived }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // Cambiar un filtro reinicia la paginación: quedarse en la página 4 de un
    // resultado que ahora tiene una sola página muestra una lista vacía.
    params.delete("page");
    params.delete("all");
    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  }

  const client = searchParams.get("client") ?? "";
  const status = searchParams.get("status") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const folder = searchParams.get("folder") ?? "";

  const hasFilters = Boolean(client || status || from || to || showArchived);

  // El export recibe los filtros vigentes, nunca la página ni el acumulador.
  const exportParams = new URLSearchParams();
  if (client) exportParams.set("client", client);
  if (status) exportParams.set("status", status);
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (folder) exportParams.set("folder", folder);

  const exportHref = exportParams.toString()
    ? `/api/export/orders?${exportParams}`
    : "/api/export/orders";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-client">Cliente</Label>
          <SearchSelect
            id="filter-client"
            options={clients.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            value={client}
            onChange={(value) => setParam("client", value || null)}
            placeholder="Todos"
            searchPlaceholder="Buscar cliente…"
            clearLabel="Todos"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-status">Estado</Label>
          <SearchSelect
            id="filter-status"
            options={STATUSES.map((value) => ({
              value,
              label: CUTTING_ORDER_STATUS_LABELS[value],
            }))}
            value={status}
            onChange={(value) => setParam("status", value || null)}
            placeholder="Todos"
            searchPlaceholder="Buscar estado…"
            clearLabel="Todos"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-from">Desde</Label>
          <Input
            id="filter-from"
            type="date"
            value={from}
            onChange={(event) => setParam("from", event.target.value || null)}
            className="tabular touch-target"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-to">Hasta</Label>
          <Input
            id="filter-to"
            type="date"
            value={to}
            onChange={(event) => setParam("to", event.target.value || null)}
            className="tabular touch-target"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ExportButton href={exportHref} />

        {/* Los pedidos archivados se piden a propósito: son los entregados, y
            si salieran siempre la lista crecería sin parar con trabajo que ya
            no existe. */}
        <button
          type="button"
          onClick={() => setParam("archived", showArchived ? null : "1")}
          aria-pressed={showArchived}
          className={
            showArchived
              ? "touch-target flex items-center gap-1.5 rounded border border-primary bg-card px-3 text-sm text-primary"
              : "touch-target flex items-center gap-1.5 rounded border border-border bg-card px-3 text-sm text-muted-foreground"
          }
        >
          <Archive className="size-3.5" aria-hidden />
          Archivados
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={() => router.replace(pathname)}
            className="touch-target flex items-center gap-1.5 rounded border border-border bg-card px-3 text-sm text-muted-foreground"
          >
            <X className="size-3.5" aria-hidden />
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
