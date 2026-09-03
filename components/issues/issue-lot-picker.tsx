"use client";

import { useState } from "react";
import { Loader2, Scissors, X } from "lucide-react";
import type { IssueLotOption } from "@/app/actions/issue.actions";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { cn, formatQuantity } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { Unit } from "@prisma/client";

/**
 * A partir de cuántos rollos se ofrece el buscador.
 *
 * Con cinco en pantalla se encuentran a ojo y una caja de texto de más sólo
 * estorba con el pulgar. El scroll empieza a doler bastante después: hay
 * materiales con 73 rollos en bodega.
 */
const SEARCHABLE_FROM = 6;

/**
 * Las cuatro caras del selector, nunca dos a la vez.
 *
 * Con `isLoading`, `error` y `lots` como estados sueltos había un instante en
 * que la lista del material anterior convivía con el spinner de la nueva
 * búsqueda, y el auxiliar alcanzaba a tocar un rollo que ya no correspondía.
 */
export type PickerState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; lots: IssueLotOption[] };

interface Props {
  state: PickerState;
  /** Rollos ya usados en otros renglones: no se ofrecen dos veces. */
  excludeLotIds: string[];
  /** Con cliente elegido, el mensaje de vacío lo aclara. */
  hasClientFilter: boolean;
  onPick: (lot: IssueLotOption) => void;
}

/**
 * Lista los rollos de los que se puede surtir un material.
 *
 * No busca por su cuenta: recibe el resultado ya resuelto. La búsqueda la
 * dispara el formulario al elegir material, que es el evento real; hacerla
 * aquí obligaría a un efecto que sólo reaccionaría a ese mismo evento.
 *
 * El orden lo decide el servidor (retazos primero, luego FIFO) y aquí NO se
 * reordena: si el auxiliar toma siempre el primero, los retazos se consumen
 * antes de volverse basura. Es la única razón de que el retazo salga marcado.
 */
export function IssueLotPicker({
  state,
  excludeLotIds,
  hasClientFilter,
  onPick,
}: Props) {
  /* Los dos filtros de la lista. Viven aquí y no en el formulario porque son
     de cómo se está MIRANDO el material abierto, no de la salida que se está
     capturando: al cambiar de material el selector se remonta y se limpian
     solos. */
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState<string | null>(null);

  if (state.kind === "idle") {
    return (
      <p className="text-sm text-muted-foreground">
        Elige el material para ver sus rollos.
      </p>
    );
  }

  if (state.kind === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Buscando rollos…
      </p>
    );
  }

  if (state.kind === "error") {
    return <p className="text-sm text-destructive">{state.message}</p>;
  }

  const selectable = state.lots.filter(
    (lot) => !excludeLotIds.includes(lot.id),
  );

  if (selectable.length === 0) {
    /* Se distingue "ya los tomaste todos" de "no hay": son dos situaciones
       distintas y el mismo mensaje para ambas hacía pensar que el sistema
       no encontraba material que sí estaba en la bodega. */
    const allTaken = state.lots.length > 0;

    return (
      <div className="flex flex-col gap-2 border border-border bg-muted p-3">
        <p className="text-sm">
          {allTaken
            ? "Ya agregaste todos los rollos de este material."
            : "No hay rollos de este material en bodega."}
        </p>
        {!allTaken && hasClientFilter && (
          <p className="text-xs text-muted-foreground">
            Estás filtrando por cliente: sólo se ofrecen rollos de su
            propiedad. Quita el filtro para ver el resto.
          </p>
        )}
      </div>
    );
  }

  /* Las unidades que de verdad hay entre estos rollos. Casi siempre es una
     sola —la tela llega en metros— y en ese caso los botones no se pintan: un
     filtro con una única opción no filtra nada y ocupa una fila entera de la
     pantalla del celular. Aparecen cuando sirven, como en la entretela, que
     está en bodega en yardas y en metros a la vez. */
  const units = [...new Set(selectable.map((lot) => lot.unit))];
  const showUnits = units.length > 1;
  const showSearch = selectable.length >= SEARCHABLE_FROM;

  const visible = selectable.filter(
    (lot) =>
      (!unit || lot.unit === unit) && matchesQuery(lot, query),
  );

  return (
    <div className="flex flex-col gap-2">
      {showSearch && (
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Folio, tono o ubicación…"
          // `search` y no `text`: el teclado del celular saca la lupa en vez
          // del "Enter", que aquí no envía nada.
          inputMode="search"
          className="touch-target"
          aria-label="Buscar entre los rollos de este material"
        />
      )}

      {showUnits && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por unidad">
          <UnitChip
            label="Todas"
            active={unit === null}
            onClick={() => setUnit(null)}
          />
          {units.map((value) => (
            <UnitChip
              key={value}
              label={UNIT_SHORT_LABELS[value as Unit] ?? value}
              active={unit === value}
              onClick={() => setUnit(unit === value ? null : value)}
            />
          ))}
        </div>
      )}

      {/* Se dice cuántos quedaron y cómo volver atrás: una lista vacía tras
          teclear se lee como "no hay rollos", que es justo lo contrario. */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-start gap-2 border border-border bg-muted p-3">
          <p className="text-sm">
            Ningún rollo de este material coincide con lo que buscas.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setUnit(null);
            }}
            className="touch-target flex items-center gap-1.5 text-sm underline"
          >
            <X className="size-3.5" aria-hidden />
            Quitar el filtro
          </button>
        </div>
      ) : (
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {visible.map((lot) => (
            <li key={lot.id}>
              <button
                type="button"
                onClick={() => onPick(lot)}
                className={cn(
                  "touch-target flex w-full items-center justify-between gap-3",
                  "border border-border bg-card p-3 text-left transition-colors",
                  "hover:bg-accent active:bg-accent",
                )}
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="tabular text-sm font-medium">{lot.code}</span>
                    {lot.isRemnant && (
                      <span className="flex items-center gap-1 rounded bg-state-remnant-muted px-1.5 py-0.5 text-xs text-state-remnant">
                        <Scissors className="size-3" aria-hidden />
                        Retazo
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {lot.shade && `Tono ${lot.shade} · `}
                    {lot.locationCode ?? "Sin ubicación"}
                  </span>
                </span>

                <span className="tabular shrink-0 text-sm font-medium">
                  {formatQuantity(lot.available, {
                    unit: UNIT_SHORT_LABELS[lot.unit as Unit],
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * ¿Este rollo casa con lo tecleado?
 *
 * Se busca contra folio, tono y ubicación porque son las tres formas en que
 * el auxiliar identifica un rollo concreto: trae la etiqueta en la mano, le
 * pidieron un tono en particular, o sabe en qué rack está. Sin acentos y sin
 * distinguir mayúsculas: nadie teclea "Ubicación A-3" con acento y con el
 * pulgar.
 */
function matchesQuery(lot: IssueLotOption, query: string): boolean {
  const needle = normalize(query);
  if (!needle) return true;

  return [lot.code, lot.shade, lot.locationCode]
    .filter(Boolean)
    .some((field) => normalize(String(field)).includes(needle));
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    // Los acentos se separan con NFD y aquí se tiran: así "ubicacion" casa
    // con "Ubicación". Nadie teclea acentos de pie y con guantes.
    .replace(/[̀-ͯ]/g, "");
}

/** Un botón de unidad. Fondo sólido para el activo, como el resto del sistema. */
function UnitChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "touch-target flex shrink-0 items-center rounded border px-3 text-sm transition-colors",
        active
          ? "border-primary bg-primary font-medium text-primary-foreground"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}
