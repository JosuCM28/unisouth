"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Info } from "lucide-react";
import { toast } from "sonner";
import { recountLotAction } from "@/app/actions/lot.actions";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { cn, formatQuantity } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RecountDialogProps {
  lotId: string;
  lotCode: string;
  currentQuantity: number;
  unit: keyof typeof UNIT_SHORT_LABELS;
  trigger: ReactNode;
}

/**
 * Reconteo: lo que de verdad hay contra lo que dice el sistema.
 *
 * La diferencia se muestra en vivo y con color porque es el dato que decide
 * si vale la pena registrar el ajuste. El motivo es obligatorio: un ajuste
 * sin explicación no sirve de nada seis meses después.
 */
export function RecountDialog({
  lotId,
  lotCode,
  currentQuantity,
  unit,
  trigger,
}: RecountDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unitLabel = UNIT_SHORT_LABELS[unit];
  const counted = parseQuantity(value);
  const difference = counted === null ? null : round4(counted - currentQuantity);

  async function handleSubmit() {
    if (counted === null || counted < 0) {
      toast.error("Escribe la cantidad que mediste.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Escribe el motivo del reconteo.");
      return;
    }

    setIsSubmitting(true);
    const result = await recountLotAction({
      lotId,
      countedQuantity: String(counted),
      reason: reason.trim(),
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Reconteo aplicado");
    setValue("");
    setReason("");
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={`Recontar ${lotCode}`}
      description={`El sistema dice ${formatQuantity(currentQuantity, { unit: unitLabel })}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-center gap-2 border-b border-border pb-4">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="0"
            aria-label="Cantidad medida"
            className="tabular w-full min-w-0 bg-transparent text-center text-3xl font-semibold outline-none placeholder:text-muted-foreground"
          />
          <span className="shrink-0 text-lg text-muted-foreground">
            {unitLabel}
          </span>
        </div>

        <DifferenceRow difference={difference} unitLabel={unitLabel} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">Motivo</Label>
          <Textarea
            id="reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Faltante detectado en conteo físico"
            aria-invalid={false}
          />
        </div>

        {/* El auxiliar debe saber que esto no es una edición silenciosa. */}
        <div className="flex items-start gap-2 border border-border p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">
            El ajuste queda en la bitácora con tu nombre, la fecha y el motivo.
            No se puede borrar; una corrección es otro reconteo.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || counted === null || !reason.trim()}
          className="h-14 w-full text-base"
        >
          <ClipboardCheck className="size-5" aria-hidden />
          {isSubmitting ? "Aplicando…" : "Aplicar reconteo"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}

/**
 * La diferencia con color. Se resuelve con salidas tempranas y no con
 * ternarias anidadas: son tres estados con significado distinto.
 */
function DifferenceRow({
  difference,
  unitLabel,
}: {
  difference: number | null;
  unitLabel: string;
}) {
  if (difference === null) {
    return (
      <div className="flat-surface flex items-center justify-between p-3">
        <span className="text-sm text-muted-foreground">Diferencia</span>
        <span className="tabular text-lg text-muted-foreground">—</span>
      </div>
    );
  }

  if (difference === 0) {
    return (
      <div className="flat-surface flex items-center justify-between p-3">
        <span className="text-sm text-muted-foreground">Diferencia</span>
        <span className="tabular text-lg font-semibold text-state-available">
          Cuadra
        </span>
      </div>
    );
  }

  const isSurplus = difference > 0;

  return (
    <div className="flat-surface flex items-center justify-between p-3">
      <span className="text-sm text-muted-foreground">
        {isSurplus ? "Sobra" : "Falta"}
      </span>
      <span
        className={cn(
          "tabular text-lg font-semibold",
          isSurplus ? "text-state-available" : "text-destructive",
        )}
      >
        {isSurplus && "+"}
        {formatQuantity(difference, { unit: unitLabel })}
      </span>
    </div>
  );
}

function parseQuantity(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
