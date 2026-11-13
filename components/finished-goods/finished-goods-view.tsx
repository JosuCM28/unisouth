"use client";

import { PackageCheck, SlidersHorizontal } from "lucide-react";
import type { FinishedStockRow } from "@/lib/repositories/finished-goods.repository";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { FinishedAdjustDialog, type AdjustOptions } from "./finished-adjust-dialog";
import { FinishedKardexDialog } from "./finished-kardex-dialog";
import { FinishedStockList, NO_PO_LABEL } from "./finished-stock-list";

/**
 * La lista con sus acciones. Cliente porque cada renglón abre ventanas; los
 * datos ya llegaron filtrados del servidor.
 */
export function FinishedGoodsView({
  rows,
  truncated,
  filtered,
  adjustOptions,
}: {
  rows: FinishedStockRow[];
  truncated: boolean;
  filtered: boolean;
  /** `null` = quien mira no puede ajustar. */
  adjustOptions: AdjustOptions | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={PackageCheck}
          title={filtered ? "Nada con esos filtros" : "Aún no hay prenda terminada"}
          description={filtered ? "Quita algún filtro." : "Llega cuando un taller de confección le da salida a Embarques."}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {truncated && (
        <p className="border border-border bg-muted p-2 text-sm">
          Se muestran los primeros {rows.length} renglones. Afina los filtros para ver el resto.
        </p>
      )}
      <FinishedStockList
        rows={rows}
        renderActions={(row) => {
          const label = `${row.product.name} · ${row.size.code} · ${row.clientPo ?? NO_PO_LABEL}`;
          return (
            <>
              <FinishedKardexDialog stockId={row.id} title={label} />
              {adjustOptions && (
                <FinishedAdjustDialog
                  options={adjustOptions}
                  preset={{
                    productId: row.product.id, sizeId: row.size.id,
                    clientId: row.client?.id ?? null, clientPo: row.clientPo, label,
                  }}
                  trigger={
                    <Button variant="ghost" size="icon" className="touch-target" aria-label={`Ajustar ${label}`}>
                      <SlidersHorizontal className="size-4" aria-hidden />
                    </Button>
                  }
                />
              )}
            </>
          );
        }}
      />
    </div>
  );
}
