"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cancelLotAction } from "@/app/actions/lot.actions";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatQuantity } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CancelLotDialogProps {
  lotId: string;
  lotCode: string;
  currentQuantity: number;
  unit: keyof typeof UNIT_SHORT_LABELS;
  trigger: ReactNode;
}

/**
 * Cancelación (baja) de un rollo.
 *
 * El motivo es obligatorio y el botón queda deshabilitado hasta que se
 * escriba: es la única forma de que dentro de seis meses alguien entienda
 * por qué ese rollo dejó de contar. La misma exigencia la repiten el esquema
 * de Zod y AuditService, así que no se puede saltar desde ningún lado.
 *
 * Se avisa del saldo que se va a descargar porque cancelar un rollo con
 * material encima es una decisión distinta a cancelar uno ya agotado.
 */
export function CancelLotDialog({
  lotId,
  lotCode,
  currentQuantity,
  unit,
  trigger,
}: CancelLotDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unitLabel = UNIT_SHORT_LABELS[unit];
  const hasStock = currentQuantity > 0;

  async function handleSubmit() {
    if (!reason.trim()) {
      toast.error("Escribe el motivo de la cancelación.");
      return;
    }

    setIsSubmitting(true);
    const result = await cancelLotAction({ id: lotId, reason: reason.trim() });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Rollo cancelado");
    setReason("");
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={`Cancelar ${lotCode}`}
      description="El rollo se da de baja pero no se borra: conserva su historial."
    >
      <div className="flex flex-col gap-4">
        {hasStock && (
          <div className="flex items-start gap-2 border border-destructive p-3">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden
            />
            <p className="text-xs">
              Este rollo todavía tiene{" "}
              <span className="tabular font-semibold">
                {formatQuantity(currentQuantity, { unit: unitLabel })}
              </span>
              . Al cancelarlo se descarga el saldo con un ajuste de salida y
              deja de estar disponible para surtir.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="cancel-reason">Motivo de la cancelación</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Rollo dañado por humedad, no es aprovechable"
          />
          <p className="text-xs text-muted-foreground">
            Obligatorio. Queda en la ficha del rollo y en la bitácora.
          </p>
        </div>

        <Button
          type="button"
          variant="destructive"
          onClick={handleSubmit}
          disabled={isSubmitting || !reason.trim()}
          className="h-14 w-full text-base"
        >
          <Ban className="size-5" aria-hidden />
          {isSubmitting ? "Cancelando…" : "Cancelar rollo"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
