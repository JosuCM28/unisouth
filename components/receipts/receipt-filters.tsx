"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/shared/search-select";

interface Option { id: string; label: string; hint?: string }

interface ReceiptFiltersProps {
  clients: Option[];
  suppliers: Option[];
  carriers: Option[];
  materials: Option[];
}

/**
 * Ventanas de llegada.
 *
 * "¿Qué llegó hoy?" y "¿qué llegó esta semana?" son las dos preguntas que se
 * hacen a diario, así que van primero y como chip, no escondidas en un select.
 */
const ARRIVAL_RANGES: { value: string; label: string }[] = [
  { value: "1", label: "Hoy" },
  { value: "7", label: "Esta semana" },
  { value: "30", label: "Este mes" },
];

/**
 * Filtros de recepciones.
 *
 * Los rangos de fecha son chips siempre visibles porque son el filtro que se
 * usa en el 90% de las consultas; proveedor, paquetería y cliente van detrás
 * de un botón, que se consultan de vez en cuando.
 */
export function ReceiptFilters({
  clients,
  suppliers,
  carriers,
  materials,
}: ReceiptFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showAdvanced, setShowAdvanced] = useState(false);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  }

  const arrivedWithin = searchParams.get("arrivedWithin");
  const hasFilters = [...searchParams.keys()].some((key) => key !== "q");
  const advancedCount = [
    "materialId",
    "clientId",
    "supplierId",
    "carrierId",
  ].filter((key) => searchParams.get(key)).length;

  return (
    <>
      {/* ── Rangos de fecha: siempre visibles, en los dos tamaños ── */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {ARRIVAL_RANGES.map(({ value, label }) => (
          <Chip
            key={value}
            label={label}
            active={arrivedWithin === value}
            onClick={() =>
              setParam("arrivedWithin", arrivedWithin === value ? null : value)
            }
          />
        ))}

        <Chip
          label="Filtros"
          icon={SlidersHorizontal}
          active={advancedCount > 0}
          onClick={() => setShowAdvanced((open) => !open)}
        />

        {hasFilters && (
          <Chip
            label="Limpiar"
            icon={X}
            onClick={() => router.replace(pathname)}
          />
        )}
      </div>

      {showAdvanced && (
        <div className="flex flex-col gap-2 border border-border p-3 md:flex-row md:flex-wrap md:items-center">
          {/* La tela va PRIMERO: "¿cuándo llegó la gabardina azul?" se
              pregunta mucho más que "¿qué mandó tal proveedor?". */}
          <FilterSelect
            placeholder="Material"
            value={searchParams.get("materialId")}
            options={materials}
            onChange={(v) => setParam("materialId", v)}
          />
          <FilterSelect
            placeholder="Proveedor"
            value={searchParams.get("supplierId")}
            options={suppliers}
            onChange={(v) => setParam("supplierId", v)}
          />
          <FilterSelect
            placeholder="Paquetería"
            value={searchParams.get("carrierId")}
            options={carriers}
            onChange={(v) => setParam("carrierId", v)}
          />
          <FilterSelect
            placeholder="Cliente dueño"
            value={searchParams.get("clientId")}
            options={clients}
            onChange={(v) => setParam("clientId", v)}
          />
        </div>
      )}
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
    <SearchSelect
      options={options.map((option) => ({
        value: option.id,
        label: option.label,
        // El código del material, de subtítulo: dos telas pueden llamarse
        // casi igual y es el código lo que trae impresa la etiqueta.
        hint: option.hint,
      }))}
      value={value ?? ""}
      onChange={(next) => onChange(next || null)}
      placeholder={placeholder}
      searchPlaceholder={`Buscar ${placeholder.toLowerCase()}…`}
      clearLabel={`${placeholder}: todos`}
      className="w-full md:w-48"
    />
  );
}
