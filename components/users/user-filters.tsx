"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { ROLE_LABELS, ROLE_VALUES } from "@/lib/constants/roles";
import { USER_STATUS_LABELS } from "@/lib/constants/labels";
import type { UserStatus } from "@/lib/constants/user-status";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/shared/search-input";
import { SearchSelect } from "@/components/shared/search-select";

const STATUS_CHIPS: UserStatus[] = ["ACTIVE", "SUSPENDED", "DELETED"];

interface Props {
  /** Cuántas cuentas hay en cada estado. Va en el chip, junto a la etiqueta. */
  counts: Record<UserStatus, number>;
}

/**
 * Buscador y filtros de la lista de usuarios.
 *
 * Los dados de baja NO salen por omisión —son los menos y ensuciarían la
 * lista del día a día—, pero su chip siempre está a la vista con su número:
 * si estuviera escondido, nadie encontraría a quién reactivar y el correo de
 * esa persona quedaría ocupado sin explicación.
 */
export function UserFilters({ counts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (value) params.set(key, value);
    else params.delete(key);

    // Al cambiar un filtro se vuelve a la primera página: si no, se queda en
    // la 3 de un resultado que ahora tiene una sola.
    params.delete("page");
    params.delete("all");

    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  }

  const status = searchParams.get("status");
  const role = searchParams.get("role") ?? "";
  const hasFilters = Boolean(status || role || searchParams.get("q"));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <SearchInput
          placeholder="Buscar por nombre, correo o teléfono…"
          className="md:max-w-sm"
        />

        <SearchSelect
          options={ROLE_VALUES.map((value) => ({
            value,
            label: ROLE_LABELS[value],
          }))}
          value={role}
          onChange={(value) => setParam("role", value || null)}
          placeholder="Todos los roles"
          searchPlaceholder="Buscar rol…"
          emptyMessage="Sin roles"
          clearLabel="Todos los roles"
          className="md:w-56"
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {STATUS_CHIPS.map((value) => (
          <StatusChip
            key={value}
            label={USER_STATUS_LABELS[value]}
            count={counts[value]}
            active={status === value}
            onClick={() => setParam("status", status === value ? null : value)}
          />
        ))}

        {hasFilters && (
          <button
            type="button"
            onClick={() =>
              router.replace(pathname, { scroll: false })
            }
            className="touch-target flex shrink-0 items-center gap-1 rounded border border-border px-3 text-sm text-muted-foreground"
          >
            <X className="size-3.5" aria-hidden />
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}

function StatusChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "touch-target flex shrink-0 items-center gap-2 rounded border px-3 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-secondary",
      )}
    >
      {label}
      <span className="tabular text-xs opacity-70">{count}</span>
    </button>
  );
}
