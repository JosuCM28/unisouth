"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Los tres estados del chip, en el orden en que se piensan. */
const CHIPS = [
  { value: "", label: "Todas" },
  { value: "0", label: "Sin agregar" },
  { value: "1", label: "Agregadas" },
] as const;

/**
 * El único filtro propio del módulo: si la orden ya entró al concentrado.
 *
 * Los demás —cliente, estado, fechas— no se pintan a propósito. Esta lista es
 * corta por naturaleza (las órdenes de una planta, no las de la fábrica
 * entera) y la pregunta que se le hace todos los días es una sola: "¿cuáles
 * me faltan por revisar?". Llenarla de selectores para responder eso sería
 * esconder el chip que importa entre cinco que no.
 *
 * Vive en la URL y no en estado local por la misma razón que el resto del
 * sistema: el enlace se comparte y llega a la misma vista.
 */
export function PlantOrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get("agregadas") ?? "";

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("agregadas", value);
    else params.delete("agregadas");
    /* Cambiar el chip reinicia la paginación: quedarse en la página 3 de un
       resultado que ahora tiene una sola muestra una lista vacía. */
    params.delete("page");
    params.delete("all");
    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map((chip) => (
        <button
          key={chip.value}
          type="button"
          onClick={() => select(chip.value)}
          aria-pressed={current === chip.value}
          className={cn(
            "touch-target rounded border px-3 text-sm transition-colors",
            current === chip.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
