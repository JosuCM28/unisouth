"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addPackingBoxAction, removePackingBoxAction } from "@/app/actions/packing.actions";
import { runAction } from "@/lib/offline/run-action";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

/** Un toque: crea la siguiente caja y entra a llenarla. */
export function NewBoxButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    setSaving(true);
    const result = await runAction(() => addPackingBoxAction({ id: orderId }));
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    router.push(`/packing/${orderId}/cajas/${result.data.number}`);
  }

  return (
    <Button className="touch-target" disabled={saving} onClick={handleClick}>
      <Plus className="size-4" aria-hidden />
      {saving ? "Creando…" : "Nueva caja"}
    </Button>
  );
}

/** Sólo para una caja vacía; las de atrás se recorren. */
export function RemoveBoxButton({ boxId, number }: { boxId: string; number: number }) {
  const router = useRouter();

  async function handleConfirm() {
    const result = await runAction(() => removePackingBoxAction({ boxId }));
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(`Caja ${number} quitada`);
    router.refresh();
  }

  return (
    <ConfirmDialog
      title={`¿Quitar la caja ${number}?`}
      description="Está vacía, así que no se mueve inventario. Las cajas de atrás se recorren un número para no dejar hueco."
      confirmLabel="Quitar caja"
      pendingLabel="Quitando…"
      tone="destructive"
      onConfirm={handleConfirm}
      trigger={
        <Button variant="ghost" size="icon" className="touch-target relative z-20" aria-label={`Quitar caja ${number}`}>
          <Trash2 className="size-4" aria-hidden />
        </Button>
      }
    />
  );
}
