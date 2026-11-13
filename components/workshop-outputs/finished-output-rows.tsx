"use client";

import { Plus, X } from "lucide-react";
import type { BalanceSize, WorkshopBalanceOrder } from "@/lib/services/workshop-output.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FinishedDraftRow {
  key: string;
  sizeId: string;
  clientPo: string;
  quantity: string;
  scrap: string;
  scrapReason: string;
}

let nextKey = 0;
const newKey = () => `row-${(nextKey += 1)}`;

/**
 * Reparte lo que el taller tiene de cada talla entre las PO de la orden, en
 * el orden en que se capturaron. Lo que sobra va sin PO. Es sólo el punto de
 * partida: el taller lo cambia si el corte no venía completo.
 */
export function toFinishedRows(order: WorkshopBalanceOrder | undefined): FinishedDraftRow[] {
  return (order?.sizes ?? []).flatMap(splitByPo);
}

function splitByPo(size: BalanceSize): FinishedDraftRow[] {
  const rows: FinishedDraftRow[] = [];
  let remaining = size.available;

  for (const plan of size.poPlan) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, plan.quantity);
    if (take <= 0) continue;
    rows.push(row(size.sizeId, plan.clientPo ?? "", take));
    remaining -= take;
  }
  if (remaining > 0) rows.push(row(size.sizeId, "", remaining));
  return rows;
}

function row(sizeId: string, clientPo: string, quantity: number): FinishedDraftRow {
  return { key: newKey(), sizeId, clientPo, quantity: String(quantity), scrap: "", scrapReason: "" };
}

/**
 * Tallas con sus PO. Cada talla dice cuánto tiene el taller y cuánto lleva
 * repartido; "+ PO" agrega otro renglón de la misma talla.
 */
export function FinishedOutputRows({
  sizes,
  rows,
  onChange,
}: {
  sizes: BalanceSize[];
  rows: FinishedDraftRow[];
  onChange: (rows: FinishedDraftRow[]) => void;
}) {
  function update(key: string, patch: Partial<FinishedDraftRow>) {
    onChange(rows.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)));
  }

  return (
    <div className="flex flex-col gap-3">
      {sizes.map((size) => {
        const sizeRows = rows.filter((entry) => entry.sizeId === size.sizeId);
        const used = sizeRows.reduce((sum, entry) => sum + (Number(entry.quantity) || 0) + (Number(entry.scrap) || 0), 0);
        const over = used > size.available;
        return (
          <div key={size.sizeId} className="flex flex-col gap-1 border-b border-border pb-2 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="tabular text-sm font-medium">{size.sizeCode}</span>
              <span className={over ? "tabular text-xs text-destructive" : "tabular text-xs text-muted-foreground"}>
                {used} de {size.available}{over && " · te pasas"}
              </span>
            </div>
            {sizeRows.map((entry) => (
              <div key={entry.key} className="flex flex-col gap-1">
                <div className="grid grid-cols-[1fr_4.5rem_4.5rem_2.75rem] items-center gap-2">
                  <Input aria-label={`PO de ${size.sizeCode}`} placeholder="Sin PO" value={entry.clientPo}
                    onChange={(event) => update(entry.key, { clientPo: event.target.value })}
                    className="tabular touch-target uppercase" />
                  <Input inputMode="numeric" aria-label={`Salen de ${size.sizeCode}`} value={entry.quantity}
                    onChange={(event) => update(entry.key, { quantity: event.target.value })}
                    className="tabular touch-target" />
                  <Input inputMode="numeric" aria-label={`Merma de ${size.sizeCode}`} placeholder="0" value={entry.scrap}
                    onChange={(event) => update(entry.key, { scrap: event.target.value })}
                    className="tabular touch-target" />
                  <Button type="button" variant="ghost" size="icon" className="touch-target"
                    aria-label="Quitar renglón" onClick={() => onChange(rows.filter((other) => other.key !== entry.key))}>
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
                {(Number(entry.scrap) || 0) > 0 && (
                  <Input aria-label={`Motivo de la merma de ${size.sizeCode}`} placeholder="Por qué se perdieron"
                    value={entry.scrapReason} onChange={(event) => update(entry.key, { scrapReason: event.target.value })}
                    className="touch-target" />
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" className="touch-target self-start"
              onClick={() => onChange([...rows, row(size.sizeId, "", 0)])}>
              <Plus className="size-4" aria-hidden />
              PO
            </Button>
          </div>
        );
      })}
    </div>
  );
}
