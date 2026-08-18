"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { LOT_STATUS_LABELS } from "@/lib/constants/labels";
import type { LotStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/shared/search-select";

interface Option { id: string; label: string }

interface LotFiltersProps {
  materials: Option[];
  locations: Option[];
  clients: Option[];
}

/** Estados que el auxiliar filtra a diario; el resto vive en el select. */
const QUICK_STATUSES: LotStatus[] = ["AVAILABLE", "REMNANT", "RESERVED"];

/**
 * Rangos de llegada, en días hacia atrás.
 *
 * Se ofrecen ventanas cerradas en vez de un calendario: en el piso nadie
 * escoge "del 3 al 17", se pregunta "¿qué llegó esta semana?".
 */
const ARRIVAL_RANGES: { value: string; label: string; days: number }[] = [
  { value: "7", label: "Última semana", days: 7 },
  { value: "30", label: "Último mes", days: 30 },
  { value: "90", label: "Últimos 3 meses", days: 90 },
];

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
  const includeCancelled = searchParams.get("includeCancelled") === "true";
  const arrivedWithin = searchParams.get("arrivedWithin");
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* Cuántos filtros de detalle están puestos. Se muestra en el botón para que
     el auxiliar sepa que la lista está acotada aunque el panel esté cerrado:
     una lista corta sin explicación se lee como "no hay material". */
  const advancedCount = ["materialId", "locationId", "clientId", "arrivedWithin"]
    .filter((key) => searchParams.get(key))
    .length;
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
        {/* Los cancelados están fuera del listado diario; este chip los trae
            de vuelta cuando alguien va a buscar por qué se dio de baja uno. */}
        <Chip
          label="Cancelados"
          active={includeCancelled}
          onClick={() =>
            setParam("includeCancelled", includeCancelled ? null : "true")
          }
        />
        {hasFilters && (
          <Chip label="Limpiar" icon={X} onClick={() => router.replace(pathname)} />
        )}
      </div>

      {/* ── Celular: filtros de detalle ──
          Van detrás de un botón porque son los que se usan de vez en cuando;
          los de diario son los chips de arriba, que quedan siempre a la vista. */}
      <div className="flex flex-col gap-2 md:hidden">
        <Button
          type="button"
          variant="outline"
          className="touch-target justify-between"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((open) => !open)}
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtros
          </span>
          {advancedCount > 0 && (
            <span className="tabular rounded bg-primary px-1.5 text-xs text-primary-foreground">
              {advancedCount}
            </span>
          )}
        </Button>

        {showAdvanced && (
          <div className="flex flex-col gap-2 border border-border p-3">
            <MobileFilter label="Llegada">
              <FilterSelect
                placeholder="Cuándo llegó"
                value={arrivedWithin}
                options={ARRIVAL_RANGES.map(({ value, label }) => ({
                  id: value,
                  label,
                }))}
                onChange={(v) => setParam("arrivedWithin", v)}
                full
              />
            </MobileFilter>

            <MobileFilter label="Material">
              <FilterSelect
                placeholder="Material"
                value={searchParams.get("materialId")}
                options={materials}
                onChange={(v) => setParam("materialId", v)}
                full
              />
            </MobileFilter>

            <MobileFilter label="Ubicación">
              <FilterSelect
                placeholder="Ubicación"
                value={searchParams.get("locationId")}
                options={locations}
                onChange={(v) => setParam("locationId", v)}
                full
              />
            </MobileFilter>

            <MobileFilter label="Cliente dueño">
              <FilterSelect
                placeholder="Cliente"
                value={searchParams.get("clientId")}
                options={clients}
                onChange={(v) => setParam("clientId", v)}
                full
              />
            </MobileFilter>

            <MobileFilter label="Estado">
              <FilterSelect
                placeholder="Estado"
                value={status}
                options={Object.entries(LOT_STATUS_LABELS).map(([id, label]) => ({
                  id,
                  label,
                }))}
                onChange={(v) => setParam("status", v)}
                full
              />
            </MobileFilter>
          </div>
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
        <FilterSelect
          placeholder="Llegada" value={arrivedWithin}
          options={ARRIVAL_RANGES.map(({ value, label }) => ({ id: value, label }))}
          onChange={(v) => setParam("arrivedWithin", v)}
        />

        <Button
          variant={includeCancelled ? "secondary" : "outline"}
          className="touch-target"
          onClick={() =>
            setParam("includeCancelled", includeCancelled ? null : "true")
          }
        >
          {includeCancelled ? "Ocultar cancelados" : "Ver cancelados"}
        </Button>

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

function MobileFilter({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * Filtro desplegable CON buscador.
 *
 * Con 200 materiales o 60 ubicaciones, recorrer la lista con el dedo es más
 * lento que preguntarle al de junto: aquí se teclean tres letras y ya.
 */
function FilterSelect({
  placeholder, value, options, onChange, full,
}: {
  placeholder: string;
  value: string | null;
  options: Option[];
  onChange: (value: string | null) => void;
  /** En el panel de celular ocupan el ancho completo, no 11rem. */
  full?: boolean;
}) {
  return (
    <SearchSelect
      options={options.map((option) => ({
        value: option.id,
        label: option.label,
      }))}
      value={value ?? ""}
      onChange={(next) => onChange(next || null)}
      placeholder={placeholder}
      searchPlaceholder={`Buscar ${placeholder.toLowerCase()}…`}
      clearLabel={`${placeholder}: todos`}
      className={full ? "w-full" : "w-44"}
    />
  );
}
