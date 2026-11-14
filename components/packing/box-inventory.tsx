"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { packAction } from "@/app/actions/packing.actions";
import { runAction } from "@/lib/offline/run-action";
import type { FinishedStockRow } from "@/lib/repositories/finished-goods.repository";
import { EmptyState } from "@/components/shared/empty-state";
import { FinishedStockList } from "@/components/finished-goods/finished-stock-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * El inventario disponible para llenar la caja, ya filtrado. Cada renglón
 * trae su cantidad lista con todo lo que hay; se baja si va menos.
 */
export function BoxInventory({ boxId, rows }: { boxId: string; rows: FinishedStockRow[] }) {
  const available = rows.filter((row) => row.quantity > 0);
  if (available.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState icon={PackageCheck} title="Nada disponible con esos filtros" />
      </div>
    );
  }

  return (
    <FinishedStockList
      rows={available}
      // La llave lleva la cantidad: al cambiar el saldo, el campo vuelve a
      // prellenarse con lo que hay ahora y no con lo de antes.
      renderActions={(row) => <PackControl key={`${row.id}-${row.quantity}`} boxId={boxId} row={row} />}
    />
  );
}

function PackControl({ boxId, row }: { boxId: string; row: FinishedStockRow }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [saving, setSaving] = useState(false);

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
      <Input inputMode="numeric" aria-label={`Piezas de ${row.size.code} ${row.clientPo ?? ""}`} value={quantity}
        onChange={(event) => setQuantity(event.target.value)} className="tabular touch-target w-16" />
      <Button size="icon" className="touch-target" disabled={saving} aria-label="Agregar a la caja" onClick={handleClick}>
        <Plus className="size-4" aria-hidden />
      </Button>
    </>
  );
}
