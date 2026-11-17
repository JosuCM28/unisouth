"use client";

import { PackageCheck, SlidersHorizontal } from "lucide-react";
import type { FinishedStockRow } from "@/lib/repositories/finished-goods.repository";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { FinishedAdjustDialog, type AdjustOptions } from "./finished-adjust-dialog";
import { FinishedKardexDialog } from "./finished-kardex-dialog";
import { FinishedPoDialog } from "./finished-po-dialog";
import { FinishedStockTable, NO_PO_LABEL } from "./finished-stock-table";

/**
 * La tabla con sus acciones. Cliente porque cada renglón abre ventanas; los
 * datos ya llegaron filtrados del servidor.
 */
export function FinishedGoodsView({
  rows,
  truncated,
  filtered,
  adjustOptions,
  poAccess,
}: {
  rows: FinishedStockRow[];
  truncated: boolean;
  filtered: boolean;
  /** `null` = quien mira no puede ajustar. */
  adjustOptions: AdjustOptions | null;
  poAccess: PoAccess;
}) {
  return (
    <div className="flex flex-col gap-2">
      {truncated && (
        <p className="border border-border bg-muted p-2 text-sm">
          Se muestran los primeros {rows.length} renglones. Afina los filtros para ver el resto.
        </p>
      )}
      <FinishedStockTable
        rows={rows}
        emptyState={
          <div className="flat-surface">
            <EmptyState
              icon={PackageCheck}
              title={filtered ? "Nada con esos filtros" : "Aún no hay prenda terminada"}
              description={filtered ? "Quita algún filtro." : "Llega cuando un taller de confección le da salida a Embarques."}
            />
          </div>
        }
        renderActions={(row) => <RowActions row={row} adjustOptions={adjustOptions} poAccess={poAccess} />}
      />
    </div>
  );
}

/**
 * Quién mueve la PO: ponerla a lo que llegó sin ella es de Embarques;
 * cambiar la que vino de la orden, sólo de ADMIN. El botón es comodidad: la
 * barrera es la llave de cada acción.
 */
export interface PoAccess {
  canAssign: boolean;
  canChange: boolean;
}

function RowActions({
  row,
  adjustOptions,
  poAccess,
}: {
  row: FinishedStockRow;
  adjustOptions: AdjustOptions | null;
  poAccess: PoAccess;
}) {
  const label = `${row.product.name} · ${row.size.code} · ${row.clientPo ?? NO_PO_LABEL}`;
  const canMovePo = row.clientPo === null ? poAccess.canAssign : poAccess.canChange;
  return (
    <>
      <FinishedKardexDialog stockId={row.id} title={label} />
      {canMovePo && row.quantity > 0 && <FinishedPoDialog row={row} />}
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
}
