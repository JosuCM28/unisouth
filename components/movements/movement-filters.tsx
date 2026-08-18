"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import { MOVEMENT_TYPE_LABELS, toSelectOptions } from "@/lib/constants/labels";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/shared/search-select";

interface Props {
  materials: { id: string; code: string; name: string }[];
}

/**
 * Filtros del kárdex.
 *
 * El estado vive en la URL y no en `useState`: así el auxiliar puede mandar
 * por WhatsApp "las salidas de mezclilla de esta semana" como un enlace, y
 * volver atrás en el navegador deshace el filtro en vez de salirse.
 */
export function MovementFilters({ materials }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (value) params.set(key, value);
    else params.delete(key);

    // Cambiar un filtro devuelve a la primera página: quedarse en la 7 de un
    // resultado que ahora tiene 2 muestra una lista vacía sin explicación.
    params.delete("page");

    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  }

  const direction = searchParams.get("direction");
  const hasFilters = [...searchParams.keys()].length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* El atajo que se usa el 90% de las veces: entradas o salidas. */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        <DirectionChip
          label="Entradas"
          icon={ArrowDownLeft}
          active={direction === "IN"}
          onClick={() => setParam("direction", direction === "IN" ? null : "IN")}
        />
        <DirectionChip
          label="Salidas"
          icon={ArrowUpRight}
          active={direction === "OUT"}
          onClick={() =>
            setParam("direction", direction === "OUT" ? null : "OUT")
          }
        />

        {hasFilters && (
          <button
            type="button"
            onClick={() => router.replace(pathname)}
            className="touch-target flex shrink-0 items-center gap-1.5 rounded border border-border bg-card px-3 text-sm text-muted-foreground"
          >
            <X className="size-3.5" aria-hidden />
            Limpiar
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="movement-material">Material</Label>
          <SearchSelect
            id="movement-material"
            options={materials.map((material) => ({
              value: material.id,
              label: material.name,
              hint: material.code,
              keywords: material.code,
            }))}
            value={searchParams.get("materialId") ?? ""}
            onChange={(next) => setParam("materialId", next || null)}
            placeholder="Todos"
            searchPlaceholder="Buscar por código o nombre…"
            clearLabel="Todos"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="movement-type">Tipo de movimiento</Label>
          <SearchSelect
            id="movement-type"
            options={toSelectOptions(MOVEMENT_TYPE_LABELS)}
            value={searchParams.get("type") ?? ""}
            onChange={(next) => setParam("type", next || null)}
            placeholder="Todos"
            searchPlaceholder="Buscar tipo…"
            clearLabel="Todos"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="movement-from">Desde</Label>
          <Input
            id="movement-from"
            type="date"
            className="touch-target tabular"
            value={searchParams.get("from") ?? ""}
            onChange={(event) => setParam("from", event.target.value || null)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="movement-to">Hasta</Label>
          <Input
            id="movement-to"
            type="date"
            className="touch-target tabular"
            value={searchParams.get("to") ?? ""}
            onChange={(event) => setParam("to", event.target.value || null)}
          />
        </div>
      </div>
    </div>
  );
}

interface ChipProps {
  label: string;
  icon: typeof ArrowDownLeft;
  active: boolean;
  onClick: () => void;
}

function DirectionChip({ label, icon: Icon, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "touch-target flex shrink-0 items-center gap-1.5 rounded border px-3 text-sm transition-colors",
        active
          ? "border-primary bg-primary font-medium text-primary-foreground"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}
