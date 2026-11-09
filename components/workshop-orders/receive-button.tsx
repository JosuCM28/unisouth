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

/**
 * Confirma que la entrega llegó.
 *
 * Con un paso de confirmación porque el taller no lo puede deshacer: en cuanto
 * se aprieta, la casa da por hecho que el corte ya está allá.
 */
export function ReceiveButton({
  id,
  code,
  pieces,
  bundles,
}: {
  id: string;
  code: string;
  pieces: number;
  bundles: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirm() {
    setIsSaving(true);
    const result = await runAction(() =>
      confirmWorkshopDeliveryAction({ id }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Entrega marcada como recibida");
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`¿Ya te llegó ${code}?`}
      description={`Confirma que recibiste ${pieces} piezas en ${bundles} bultos. Avisa a la fábrica de inmediato y no se puede deshacer.`}
      trigger={
        <Button className="touch-target w-full sm:w-auto">
          <PackageCheck className="size-4" aria-hidden />
          Marcar como recibida
        </Button>
      }
    >
      <SubmitButton
        isSubmitting={isSaving}
        onClick={handleConfirm}
        className="h-12 w-full"
      >
        Sí, ya me llegó
      </SubmitButton>
    </ResponsiveFormDialog>
  );
}
