"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PackingOrderStatus } from "@prisma/client";
import {
  closePackingOrderAction,
  removePackingOrderAction,
  reopenPackingOrderAction,
} from "@/app/actions/packing.actions";
import { runAction } from "@/lib/offline/run-action";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PackingOrderFormDialog, type EditablePackingOrder } from "./packing-order-form-dialog";

/**
 * Lo que se hace con el pedido entero. Abierto: editar, cerrar, borrar.
 * Cerrado: sólo reabrir, con motivo.
 */
export function PackingOrderActions({
  order,
  status,
  clients,
}: {
  order: EditablePackingOrder;
  status: PackingOrderStatus;
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();

  /** `false` deja abierto el diálogo: el servidor dijo que no y se lee por qué. */
  async function run(action: () => ReturnType<typeof closePackingOrderAction>, after?: () => void) {
    const result = await runAction(action);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Listo");
    if (after) after();
    else router.refresh();
    return true;
  }

  if (status === "CLOSED") return <ReopenButton id={order.id} />;

  return (
    <div className="flex flex-wrap gap-2">
      <PackingOrderFormDialog order={order} clients={clients}
        trigger={<Button variant="outline" className="touch-target"><Pencil className="size-4" aria-hidden />Editar</Button>} />
      <ConfirmDialog
        title="¿Cerrar el pedido?"
        description="Sus cajas quedan selladas: ya no se puede meter ni sacar prenda. El packing list se sigue pudiendo corregir. Para volver a moverlo habrá que reabrirlo con motivo."
        confirmLabel="Cerrar pedido"
        pendingLabel="Cerrando…"
        onConfirm={() => run(() => closePackingOrderAction({ id: order.id }))}
        trigger={<Button variant="outline" className="touch-target"><Lock className="size-4" aria-hidden />Cerrar</Button>}
      />
      <ConfirmDialog
        title={`¿Borrar ${order.name}?`}
        description="Sólo se puede si todas sus cajas están vacías. El pedido desaparece de la lista y no se puede recuperar."
        confirmLabel="Borrar pedido"
        pendingLabel="Borrando…"
        tone="destructive"
        onConfirm={() => run(() => removePackingOrderAction({ id: order.id }), () => router.push("/packing"))}
        trigger={
          <Button variant="outline" className="touch-target text-destructive hover:text-destructive">
            <Trash2 className="size-4" aria-hidden />Borrar
          </Button>
        }
      />
    </div>
  );
}

function ReopenButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleReopen() {
    setSaving(true);
    const result = await runAction(() => reopenPackingOrderAction({ id, reason: reason.trim() }));
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Pedido reabierto");
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog open={open} onOpenChange={setOpen} title="Reabrir pedido"
      description="Queda en la auditoría con el motivo."
      trigger={<Button variant="outline" className="touch-target"><LockOpen className="size-4" aria-hidden />Reabrir</Button>}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reopen-reason">Motivo</Label>
          <Textarea id="reopen-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)}
            placeholder="Faltó una caja de tallas G" />
        </div>
        <Button type="button" className="h-12 w-full" disabled={saving || !reason.trim()} onClick={handleReopen}>
          {saving ? "Reabriendo…" : "Reabrir"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
