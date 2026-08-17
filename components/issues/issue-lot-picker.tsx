"use client";

import { Loader2, Scissors } from "lucide-react";
import type { IssueLotOption } from "@/app/actions/issue.actions";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { cn, formatQuantity } from "@/lib/utils";
import type { Unit } from "@prisma/client";

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
  if (state.kind === "idle") {
    return (
      <p className="text-sm text-muted-foreground">
        Elige primero el material.
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
    return (
      <p className="text-sm text-muted-foreground">
        No hay rollos disponibles de este material
        {hasClientFilter && " para este cliente"}.
      </p>
    );
  }

  return (
    <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
      {selectable.map((lot) => (
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
  );
}
