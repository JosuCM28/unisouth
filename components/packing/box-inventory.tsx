"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { packAction } from "@/app/actions/packing.actions";
import { runAction } from "@/lib/offline/run-action";
import type { FinishedStockRow } from "@/lib/repositories/finished-goods.repository";
import { EmptyState } from "@/components/shared/empty-state";
import { FinishedStockTable, NO_PO_LABEL } from "@/components/finished-goods/finished-stock-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * El inventario disponible para llenar la caja, ya filtrado. Cada renglón
 * trae su campo vacío para escribir cuántas piezas van.
 */
export function BoxInventory({ boxId, rows }: { boxId: string; rows: FinishedStockRow[] }) {
  return (
    <FinishedStockTable
      rows={rows.filter((row) => row.quantity > 0)}
      columnsKey="packing-box-inventory"
      emptyState={
        <div className="flat-surface">
          <EmptyState icon={PackageCheck} title="Nada disponible con esos filtros" />
        </div>
      }
      // La llave lleva la cantidad: al cambiar el saldo, el campo se limpia
      // y no se queda con lo que se acaba de meter.
      renderActions={(row) => <PackControl key={`${row.id}-${row.quantity}`} boxId={boxId} row={row} />}
    />
  );
}

function PackControl({ boxId, row }: { boxId: string; row: FinishedStockRow }) {
  const router = useRouter();
  // Arranca vacío (el 0 es sólo guía): casi nunca va todo el saldo a una
  // caja, y prellenarlo obligaba a borrar antes de escribir.
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const hasQuantity = Number(quantity) > 0;

  async function handleClick() {
    setSaving(true);
    const result = await runAction(() => packAction({ boxId, stockId: row.id, quantity }));
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`${quantity} pzas a la caja`);
    router.refresh();
  }

  return (
    <>
      <Input inputMode="numeric" aria-label={`Piezas de ${row.size.code} ${row.clientPo ?? NO_PO_LABEL}`}
        placeholder="0" value={quantity} onChange={(event) => setQuantity(event.target.value)}
        className="tabular touch-target w-16" />
      <Button size="icon" className="touch-target" disabled={saving || !hasQuantity} aria-label="Agregar a la caja" onClick={handleClick}>
        <Plus className="size-4" aria-hidden />
      </Button>
    </>
  );
}
