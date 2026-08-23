"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/shared/search-select";

export interface PileFilterOption {
  id: string;
  label: string;
}

interface PileFiltersProps {
  clients: PileFilterOption[];
  locations: PileFilterOption[];
  colors: PileFilterOption[];
  shades: PileFilterOption[];
}

/**
 * Filtros de la pila de un material.
 *
 * Son los de la ficha, no los del inventario: aquí el material ya está
 * elegido y lo que se pregunta parado frente a la estiba es "¿cuánto hay de
 * Ternium?", "¿cuánto del tono A-42?". Por eso no se ofrecen estados ni
 * retazos ni cancelados —esos son del recorrido del almacén— y sí dueño,
 * tono, color y ubicación.
 *
 * Cada filtro se pinta SÓLO si hay de dónde escoger: en una pila de un solo
 * dueño y un solo tono, cuatro desplegables con una opción cada uno son
 * cuatro toques que no llevan a ningún lado.
 */
export function PileFilters({
  clients,
  locations,
  colors,
  shades,
}: PileFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const KEYS = ["clientId", "locationId", "colorName", "shade"];

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // La paginación es del historial de arriba, no de la pila; se conserva.
    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString());
    // Sólo los de la pila: el rango del historial no se toca, o limpiar aquí
    // recargaría también los movimientos de arriba sin que nadie lo pidiera.
    for (const key of KEYS) params.delete(key);
    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  }

  const active = KEYS.filter((key) => searchParams.get(key)).length;

  // Con una sola opción no hay nada que filtrar.
  const visible = [
    { key: "clientId", placeholder: "Dueño", options: clients },
    { key: "shade", placeholder: "Tono", options: shades },
    { key: "colorName", placeholder: "Color", options: colors },
    { key: "locationId", placeholder: "Ubicación", options: locations },
  ].filter((filter) => filter.options.length > 1);

  if (visible.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {visible.map((filter) => (
        <SearchSelect
          key={filter.key}
          options={filter.options.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          value={searchParams.get(filter.key) ?? ""}
          onChange={(next) => setParam(filter.key, next || null)}
          placeholder={filter.placeholder}
          searchPlaceholder={`Buscar ${filter.placeholder.toLowerCase()}…`}
          clearLabel={`${filter.placeholder}: todos`}
          /* Ancho completo en celular y fijo desde md:. Con cuatro
             desplegables a 11rem en una pantalla de 375px, el último queda
             cortado a la mitad. */
          className="w-full md:w-40"
        />
      ))}

      {active > 0 && (
        <Button variant="ghost" className="touch-target w-full md:w-auto" onClick={clear}>
          <X className="size-4" aria-hidden />
          Limpiar
        </Button>
      )}
    </div>
  );
}
