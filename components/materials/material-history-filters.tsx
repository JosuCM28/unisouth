"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, X } from "lucide-react";
import { HISTORY_RANGES } from "@/lib/constants/history-ranges";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  /** Preset activo, o `null` si manda un rango tecleado a mano. */
  preset: string | null;
  /** Valores actuales del rango a mano, ya en hora de la fábrica. */
  desde: string;
  hasta: string;
}

/**
 * Elige qué ventana de tiempo se está mirando.
 *
 * Los presets resuelven el 90% de las consultas con un solo toque. El rango
 * con hora existe para la pregunta que ningún preset cubre —"hoy de 6 a 8,
 * cuánto entró en el turno"— y por eso va colapsado: se abre cuando se
 * necesita, sin robarle espacio a los KPIs el resto del tiempo.
 */
export function MaterialHistoryFilters({ preset, desde, hasta }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Arranca abierto si YA se está usando: si no, al recargar la página el
  // usuario vería un rango aplicado sin ver de dónde sale.
  const [open, setOpen] = useState(preset === null);
  const [from, setFrom] = useState(desde);
  const [to, setTo] = useState(hasta);

  /** Conserva los demás parámetros: la paginación y el filtro de dirección. */
  function push(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    // Cambiar de ventana invalida la página en la que se iba.
    params.delete("page");
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  function selectPreset(key: string) {
    push((params) => {
      params.set("rango", key);
      // El rango a mano gana sobre el preset, así que hay que retirarlo o el
      // toque en la pestaña no tendría ningún efecto visible.
      params.delete("desde");
      params.delete("hasta");
    });
    setOpen(false);
  }

  function applyCustom() {
    if (!from || !to) return;

    push((params) => {
      params.set("desde", from);
      params.set("hasta", to);
      params.delete("rango");
    });
  }

  function clearCustom() {
    setFrom("");
    setTo("");
    push((params) => {
      params.delete("desde");
      params.delete("hasta");
    });
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Periodo">
        {HISTORY_RANGES.map((range) => (
          <button
            key={range.key}
            type="button"
            onClick={() => selectPreset(range.key)}
            aria-pressed={preset === range.key}
            className={cn(
              "touch-target flex-1 rounded border px-3 text-sm transition-colors sm:flex-none",
              preset === range.key
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {range.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-pressed={preset === null}
          aria-expanded={open}
          className={cn(
            "touch-target flex flex-1 items-center justify-center gap-1.5 rounded border px-3 text-sm transition-colors sm:flex-none",
            preset === null
              ? "border-primary bg-primary font-medium text-primary-foreground"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          <CalendarClock className="size-4" aria-hidden />
          Por hora
        </button>
      </div>

      {open && (
        <div className="flat-surface flex flex-col gap-3 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="history-from">Desde</Label>
              <Input
                id="history-from"
                type="datetime-local"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="touch-target tabular"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="history-to">Hasta</Label>
              <Input
                id="history-to"
                type="datetime-local"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="touch-target tabular"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={applyCustom}
              disabled={!from || !to}
              className="touch-target"
            >
              Aplicar
            </Button>

            {preset === null && (
              <Button
                type="button"
                variant="outline"
                onClick={clearCustom}
                className="touch-target"
              >
                <X className="size-4" aria-hidden />
                Quitar
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            La hora es la de la planta. Para un turno, por ejemplo, de 06:00 a
            08:00 del mismo día.
          </p>
        </div>
      )}
    </div>
  );
}
