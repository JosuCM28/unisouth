"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { confirmWorkshopDeliveryAction } from "@/app/actions/workshop-delivery.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_NOTE_LENGTH = 500;

/**
 * Confirma que la entrega llegó, con una nota opcional.
 *
 * Con un paso de confirmación porque el taller no lo puede deshacer: en cuanto
 * se aprieta, la casa da por hecho que el corte ya está allá. La nota vive aquí
 * porque es el momento en que se cuentan los bultos y se ve si algo vino mal.
 */
export function ReceiveButton({
  id,
  code,
  pieces,
  bundles,
  onReceived,
}: {
  id: string;
  code: string;
  pieces: number;
  bundles: number;
  /** Para quien lo pinta dentro de otra ventana y debe volver a leer la ficha. */
  onReceived?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setNotes("");
  }

  async function handleConfirm() {
    setIsSaving(true);
    const result = await runAction(() =>
      confirmWorkshopDeliveryAction({ id, notes: notes || undefined }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Entrega marcada como recibida");
    handleOpenChange(false);
    onReceived?.();
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`¿Ya te llegó ${code}?`}
      description={`Confirma que recibiste ${pieces} piezas en ${bundles} bultos. Avisa a la fábrica de inmediato y no se puede deshacer.`}
      trigger={
        <Button className="touch-target w-full sm:w-auto">
          <PackageCheck className="size-4" aria-hidden />
          Recibir
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`receive-notes-${id}`}>Nota (opcional)</Label>
          <Textarea
            id={`receive-notes-${id}`}
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Llegaron 2 bultos mojados"
          />
        </div>

        <SubmitButton
          isSubmitting={isSaving}
          onClick={handleConfirm}
          className="h-12 w-full"
        >
          Sí, ya me llegó
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}
