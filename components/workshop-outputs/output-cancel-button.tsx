"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import {
  cancelWorkshopOutputAction,
  cancelWorkshopOutputAsAdminAction,
} from "@/app/actions/workshop-output.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Cancela una salida de taller con motivo. No se edita ni se borra: se
 * cancela y se captura otra, y las piezas regresan al saldo del taller.
 *
 * `asAdmin` elige la action: el taller cancela la suya; ADMIN, desde la
 * orden, la de cualquiera. Cada una exige su propia llave.
 */
export function OutputCancelButton({
  id,
  code,
  asAdmin = false,
}: {
  id: string;
  code: string;
  asAdmin?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCancel() {
    const input = { id, reason: reason.trim() };
    setSaving(true);
    const result = await runAction(() =>
      asAdmin ? cancelWorkshopOutputAsAdminAction(input) : cancelWorkshopOutputAction(input),
    );
    setSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Salida ${code} cancelada`);
    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Cancelar ${code}`}
      description="Las piezas regresan al saldo del taller. La salida queda escrita como cancelada."
      trigger={
        <Button variant="outline" className="touch-target">
          <Ban className="size-4" aria-hidden />
          Cancelar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`cancel-output-${id}`}>Motivo</Label>
          <Textarea
            id={`cancel-output-${id}`}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Se capturó la talla equivocada"
          />
        </div>
        <Button
          type="button"
          onClick={handleCancel}
          disabled={saving || !reason.trim()}
          className="h-12 w-full bg-destructive text-white hover:bg-destructive/90"
        >
          {saving ? "Cancelando…" : "Confirmar cancelación"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
