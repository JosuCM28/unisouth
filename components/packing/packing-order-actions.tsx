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

  async function run(action: () => ReturnType<typeof closePackingOrderAction>, after?: () => void) {
    const result = await runAction(action);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Listo");
    if (after) after();
    else router.refresh();
  }

  if (status === "CLOSED") return <ReopenButton id={order.id} />;

  return (
    <div className="flex flex-wrap gap-2">
      <PackingOrderFormDialog order={order} clients={clients}
        trigger={<Button variant="outline" className="touch-target"><Pencil className="size-4" aria-hidden />Editar</Button>} />
      <Button variant="outline" className="touch-target"
        onClick={() => {
          if (window.confirm("¿Cerrar el pedido? Sus cajas ya no se podrán mover.")) {
            void run(() => closePackingOrderAction({ id: order.id }));
          }
        }}>
        <Lock className="size-4" aria-hidden />
        Cerrar
      </Button>
      <Button variant="outline" className="touch-target"
        onClick={() => {
          if (window.confirm("¿Borrar el pedido? Sólo se puede si sus cajas están vacías.")) {
            void run(() => removePackingOrderAction({ id: order.id }), () => router.push("/packing"));
          }
        }}>
        <Trash2 className="size-4" aria-hidden />
        Borrar
      </Button>
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
