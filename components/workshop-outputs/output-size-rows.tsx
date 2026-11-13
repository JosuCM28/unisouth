"use client";

import type { WorkshopBalanceOrder } from "@/lib/services/workshop-output.service";
import { Input } from "@/components/ui/input";

export interface DraftRow {
  sizeId: string;
  sizeCode: string;
  available: number;
  /** Texto, como lo deja el input: "" mientras se borra para reescribir. */
  quantity: string;
  scrap: string;
  scrapReason: string;
}

/** Arranca con TODO lo que el taller tiene: lo normal es que salga completo. */
export function toDraftRows(order: WorkshopBalanceOrder | undefined): DraftRow[] {
  return (order?.sizes ?? []).map((size) => ({
    sizeId: size.sizeId,
    sizeCode: size.sizeCode,
    available: size.available,
    quantity: String(size.available),
    scrap: "",
    scrapReason: "",
  }));
}

/**
 * Una fila por talla: cuántas salen buenas y cuántas se perdieron.
 *
 * El motivo de la merma sólo aparece cuando hay merma: pedirlo siempre
 * llenaría la pantalla de cajas vacías en el caso normal.
 */
export function OutputSizeRows({
  rows,
  onChange,
}: {
  rows: DraftRow[];
  onChange: (rows: DraftRow[]) => void;
}) {
  function update(sizeId: string, patch: Partial<DraftRow>) {
    onChange(rows.map((row) => (row.sizeId === sizeId ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[3.5rem_1fr_1fr] gap-2 text-xs text-muted-foreground">
        <span>Talla</span>
        <span>Salen</span>
        <span>Merma</span>
      </div>
      {rows.map((row) => {
        const used = (Number(row.quantity) || 0) + (Number(row.scrap) || 0);
        const over = used > row.available;
        return (
          <div key={row.sizeId} className="flex flex-col gap-1 border-b border-border pb-2 last:border-0">
            <div className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-2">
              <span className="tabular text-sm font-medium">{row.sizeCode}</span>
              <Input inputMode="numeric" aria-label={`Salen de ${row.sizeCode}`} value={row.quantity}
                onChange={(event) => update(row.sizeId, { quantity: event.target.value })}
                className="tabular touch-target" />
              <Input inputMode="numeric" aria-label={`Merma de ${row.sizeCode}`} value={row.scrap}
                placeholder="0" onChange={(event) => update(row.sizeId, { scrap: event.target.value })}
                className="tabular touch-target" />
            </div>
            <p className={over ? "tabular text-xs text-destructive" : "tabular text-xs text-muted-foreground"}>
              Tienes {row.available}
              {over && ` · te pasas por ${used - row.available}`}
            </p>
            {(Number(row.scrap) || 0) > 0 && (
              <Input aria-label={`Motivo de la merma de ${row.sizeCode}`} placeholder="Por qué se perdieron"
                value={row.scrapReason} onChange={(event) => update(row.sizeId, { scrapReason: event.target.value })}
                className="touch-target" />
            )}
          </div>
        );
      })}
    </div>
  );
}
