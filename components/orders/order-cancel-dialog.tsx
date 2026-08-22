"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { cancelCuttingOrderAction } from "@/app/actions/cutting-order.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Cancela una orden. No se borra: su historial de cortes debe conservarse
 * para poder responder qué se alcanzó a hacer antes de que se cayera.
 */
export function OrderCancelDialog({
  orderId,
  orderCode,
}: {
  orderId: string;
  orderCode: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleCancel() {
    if (!reason.trim()) {
      toast.error("Escribe el motivo de la cancelación.");
      return;
    }

    setIsSaving(true);
    const result = await runAction(() => cancelCuttingOrderAction({
      id: orderId,
      reason: reason.trim(),
    }));
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Orden cancelada");
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Cancelar ${orderCode}`}
      description="La orden queda cancelada y su historial de cortes se conserva."
      trigger={
        <Button variant="outline" className="touch-target">
          <Ban className="size-4" aria-hidden />
          Cancelar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cancel-reason">Motivo</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="El cliente canceló el pedido"
          />
        </div>

        <Button
          type="button"
          onClick={handleCancel}
          disabled={isSaving || !reason.trim()}
          className="h-12 w-full bg-destructive text-white hover:bg-destructive/90"
        >
          {isSaving ? "Cancelando…" : "Confirmar cancelación"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
