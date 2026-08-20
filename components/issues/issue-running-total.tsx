"use client";

import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatQuantity } from "@/lib/utils";
import type { IssueTotals } from "@/lib/issue-totals";

/**
 * Cuánto lleva el vale hasta ahora.
 *
 * Existe porque armar una salida es ir marcando rollo por rollo hasta juntar
 * los metros que pidió producción, y hasta ahora eso obligaba a sumar de
 * cabeza o a bajar la vista renglón por renglón. Con el total a la vista el
 * auxiliar sabe cuándo parar sin salirse del formulario.
 *
 * Se muestra una línea POR UNIDAD: un vale con tela y cierres no puede
 * presentar un solo número, porque metros y piezas no se suman entre sí.
 */
export function IssueRunningTotal({ totals }: { totals: IssueTotals }) {
  if (totals.lines === 0) return null;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Total que sale
        </span>
        <span className="tabular text-xs text-muted-foreground">
          {totals.lines} {totals.lines === 1 ? "rollo" : "rollos"}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {totals.totals.map((total) => (
          <span
            key={total.unit}
            className="tabular text-2xl font-bold leading-none"
          >
            {formatQuantity(total.quantity, {
              unit: UNIT_SHORT_LABELS[total.unit],
            })}
          </span>
        ))}
      </div>
    </div>
  );
}
