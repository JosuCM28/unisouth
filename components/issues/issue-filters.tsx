"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Send, X } from "lucide-react";
import type { DocumentStatus } from "@prisma/client";
import { DOCUMENT_STATUS_LABELS } from "@/lib/constants/labels";
import { WORKSHOP_ORIGIN } from "@/lib/repositories/issue-filters";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Los tres estados, en el orden en que ocurren en la vida del vale. */
const STATUS_ORDER: DocumentStatus[] = ["DRAFT", "APPLIED", "CANCELLED"];

/**
 * Chips de estado y de origen de las salidas, con el rango de fechas.
 *
 * Van como chips siempre visibles y no en un `<select>`: "¿cuáles quedaron en
 * borrador?" es la pregunta con la que se depura la captura del día, y un
 * select la esconde detrás de dos toques.
 *
 * "A taller" se suma a los tres estados porque responde la otra pregunta
 * frecuente —"¿qué anda en maquila?"— y hasta ahora no había forma de hacerla:
 * esos vales llevan folio OUT igual que todos los demás.
 *
 * Los filtros viven en la URL para que la lista siga siendo Server Component y
 * el resultado se pueda compartir y sobreviva a un refresh —clave con el WiFi
 * de la bodega—. `replace` y no `push`: filtrar no debería llenar el historial.
 */
export function IssueFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("status");
  const fromWorkshop = searchParams.get("origin") === WORKSHOP_ORIGIN;

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // Al cambiar el filtro se vuelve a la primera página: si no, queda en la 4
    // de un resultado que ahora tiene una sola.
    params.delete("page");
    params.delete("all");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const hasFilters = [...searchParams.keys()].length > 0;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  return (
    <div className="flex flex-col gap-3">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {STATUS_ORDER.map((status) => (
          <Chip
            key={status}
            label={DOCUMENT_STATUS_LABELS[status]}
            active={active === status}
            onClick={() =>
              setParam("status", active === status ? null : status)
            }
          />
        ))}

        <Chip
          label="A taller"
          icon={Send}
          active={fromWorkshop}
          onClick={() =>
            setParam("origin", fromWorkshop ? null : WORKSHOP_ORIGIN)
          }
        />

        {hasFilters && (
          <Chip
            label="Limpiar"
            icon={X}
            onClick={() => router.replace(pathname)}
          />
        )}
      </div>

      {/* El rango va DEBAJO de los chips y no en un panel que se abre: "las
          salidas de la semana pasada" es la pregunta con la que se cierra el
          mes, y esconderla detrás de un toque más la vuelve un trámite.

          Dos columnas incluso en celular: son un par y se leen juntos, y a la
          mitad del ancho el `<input type="date">` nativo sigue siendo cómodo
          porque el calendario lo pinta el sistema, no la caja. */}
      <div className="grid grid-cols-2 gap-3 md:max-w-md">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issue-from">Desde</Label>
          <Input
            id="issue-from"
            type="date"
            className="tabular touch-target"
            value={from}
            /* Se topa contra `to` en el propio input: el navegador impide de
               entrada un rango al revés, que de otro modo devolvería cero
               salidas sin decir por qué. */
            max={to || undefined}
            onChange={(event) => setParam("from", event.target.value || null)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issue-to">Hasta</Label>
          <Input
            id="issue-to"
            type="date"
            className="tabular touch-target"
            value={to}
            min={from || undefined}
            onChange={(event) => setParam("to", event.target.value || null)}
          />
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon?: typeof Check;
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
