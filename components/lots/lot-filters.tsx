"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { LOT_STATUS_LABELS } from "@/lib/constants/labels";
import type { LotStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Option { id: string; label: string }

interface LotFiltersProps {
  materials: Option[];
  locations: Option[];
  clients: Option[];
}

/** Estados que el auxiliar filtra a diario; el resto vive en el select. */
const QUICK_STATUSES: LotStatus[] = ["AVAILABLE", "REMNANT", "RESERVED"];

/**
 * Filtros del inventario.
 *
 * En celular son chips que se barren de lado con el pulgar: un select
 * obligaría a abrir un menú, apuntar y confirmar por cada filtro.
 * Desde md: se cambian por selects, que comparan mejor en pantalla grande.
 */
export function LotFilters({ materials, locations, clients }: LotFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // Al cambiar un filtro se vuelve a la primera página.
    params.delete("page");
    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  }

  function toggleParam(key: string, value: string) {
    setParam(key, searchParams.get(key) === value ? null : value);
  }

  const status = searchParams.get("status");
  const onlyRemnants = searchParams.get("onlyRemnants") === "true";
  const onlyUnverified = searchParams.get("onlyUnverified") === "true";
  const hasFilters = [...searchParams.keys()].some((key) => key !== "q");

  return (
    <>
      {/* ── Celular: chips ── */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:hidden">
        {QUICK_STATUSES.map((value) => (
          <Chip
            key={value}
            label={LOT_STATUS_LABELS[value]}
            active={status === value}
            onClick={() => toggleParam("status", value)}
          />
        ))}
        <Chip
          label="Retazos"
          active={onlyRemnants}
          onClick={() => setParam("onlyRemnants", onlyRemnants ? null : "true")}
        />
        <Chip
          label="Sin medir"
          active={onlyUnverified}
          onClick={() =>
            setParam("onlyUnverified", onlyUnverified ? null : "true")
          }
        />
        {hasFilters && (
          <Chip label="Limpiar" icon={X} onClick={() => router.replace(pathname)} />
        )}
      </div>

      {/* ── Escritorio: selects ── */}
      <div className="hidden flex-wrap gap-2 md:flex">
        <FilterSelect
          placeholder="Material" value={searchParams.get("materialId")}
          options={materials} onChange={(v) => setParam("materialId", v)}
        />
        <FilterSelect
          placeholder="Ubicación" value={searchParams.get("locationId")}
          options={locations} onChange={(v) => setParam("locationId", v)}
        />
        <FilterSelect
          placeholder="Cliente" value={searchParams.get("clientId")}
          options={clients} onChange={(v) => setParam("clientId", v)}
        />
        <FilterSelect
          placeholder="Estado" value={status}
          options={Object.entries(LOT_STATUS_LABELS).map(([id, label]) => ({ id, label }))}
          onChange={(v) => setParam("status", v)}
        />
        {hasFilters && (
          <Button variant="ghost" className="touch-target" onClick={() => router.replace(pathname)}>
            <X className="size-4" aria-hidden />
            Limpiar
          </Button>
        )}
      </div>
    </>
  );
}

function Chip({
  label, active, onClick, icon: Icon,
}: {
  label: string; active?: boolean; onClick: () => void; icon?: typeof Check;
}) {
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
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {active && !Icon && <Check className="size-3.5" aria-hidden />}
      {label}
    </button>
  );
}

function FilterSelect({
  placeholder, value, options, onChange,
}: {
  placeholder: string;
  value: string | null;
  options: Option[];
  onChange: (value: string | null) => void;
}) {
  return (
    <Select
      value={value ?? "all"}
      onValueChange={(next) => onChange(next === "all" ? null : next)}
    >
      <SelectTrigger className="touch-target w-44">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}: todos</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
