"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Lock } from "lucide-react";
import { toast } from "sonner";
import { requestCutEditAction } from "@/app/actions/cut-edit-request.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Lo que ve quien folea en lugar de "Capturar corte" cuando la orden ya está
 * terminada: pedir permiso, o saber que ya lo pidió y está esperando.
 */
export function CutEditRequestDialog({
  orderId,
  orderCode,
  pending,
}: {
  orderId: string;
  orderCode: string;
  /** Ya hay una solicitud suya sin contestar. */
  pending: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (pending) {
    return (
      <Button variant="outline" className="touch-target" disabled>
        <Clock className="size-4" aria-hidden />
        Esperando autorización
      </Button>
    );
  }

  async function handleSubmit() {
    if (!reason.trim()) {
      toast.error("Escribe qué necesitas corregir.");
      return;
    }

    setIsSaving(true);
    const result = await runAction(() =>
      requestCutEditAction({ orderId, reason: reason.trim() }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Solicitud enviada al administrador");
    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Editar cortes de ${orderCode}`}
      description="La orden está terminada. El administrador autoriza un solo guardado."
      trigger={
        <Button className="touch-target">
          <Lock className="size-4" aria-hidden />
          Solicitar edición
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cut-edit-reason">Qué necesitas corregir</Label>
          <Textarea
            id="cut-edit-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="En el 2º corte la talla 34 son 60, no 66"
          />
        </div>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving || !reason.trim()}
          className="h-12 w-full"
        >
          {isSaving ? "Enviando…" : "Enviar solicitud"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
