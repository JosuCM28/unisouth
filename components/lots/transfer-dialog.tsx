"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { transferLotAction } from "@/app/actions/lot.actions";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { FormSelectField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface TransferDialogProps {
  lotId: string;
  lotCode: string;
  currentLocationId: string | null;
  currentLocationCode?: string;
  locations: { id: string; code: string; name: string }[];
  trigger: ReactNode;
}

/**
 * Traspaso entre ubicaciones.
 *
 * No toca el saldo: genera un movimiento RECLASSIFICATION con cantidad 0,
 * para poder rastrear por dónde ha pasado el rollo.
 */
export function TransferDialog({
  lotId, lotCode, currentLocationId, currentLocationCode, locations, trigger,
}: TransferDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toLocationId, setToLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // La ubicación actual no se ofrece: traspasarse a sí misma no es nada.
  const options = locations.filter((l) => l.id !== currentLocationId);

  async function handleSubmit() {
    if (!toLocationId) {
      toast.error("Elige la ubicación destino.");
      return;
    }

    setIsSubmitting(true);
    const result = await transferLotAction({
      lotId, toLocationId, reason: reason.trim() || undefined,
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Rollo traspasado");
    setToLocationId("");
    setReason("");
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={`Traspasar ${lotCode}`}
      description={
        currentLocationCode
          ? `Ahora está en ${currentLocationCode}. El saldo no cambia.`
          : "Sin ubicación asignada. El saldo no cambia."
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelectField id="toLocationId" label="Mover a">
          <Select value={toLocationId} onValueChange={setToLocationId}>
            <SelectTrigger id="toLocationId" className="touch-target w-full">
              <SelectValue placeholder="Elige la ubicación" />
            </SelectTrigger>
            <SelectContent>
              {options.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  <span className="tabular">{location.code}</span> · {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSelectField>

        <div className="flex flex-col gap-2">
          <Label htmlFor="transfer-reason">Motivo (opcional)</Label>
          <Textarea
            id="transfer-reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reacomodo de fila"
          />
        </div>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !toLocationId}
          className="h-14 w-full text-base"
        >
          <ArrowRightLeft className="size-5" aria-hidden />
          {isSubmitting ? "Traspasando…" : "Traspasar"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
