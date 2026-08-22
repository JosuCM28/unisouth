"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";
import { toast } from "sonner";
import { cutLotAction } from "@/app/actions/lot.actions";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatQuantity } from "@/lib/utils";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";

interface CutLotDialogProps {
  lotId: string;
  lotCode: string;
  /** Saldo vivo del rollo. */
  currentQuantity: number;
  reservedQuantity: number;
  unit: keyof typeof UNIT_SHORT_LABELS;
  trigger: ReactNode;
}

/**
 * Corte de rollo: la operación de todos los días.
 *
 * Toda la pantalla está puesta al servicio de un solo número. El input
 * arranca enfocado y el teclado numérico sale solo, así que desde la ficha
 * son dos toques: "Cortar" y "Confirmar".
 */
export function CutLotDialog({
  lotId,
  lotCode,
  currentQuantity,
  reservedQuantity,
  unit,
  trigger,
}: CutLotDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unitLabel = UNIT_SHORT_LABELS[unit];
  // Nunca se surte por encima del disponible: lo reservado ya está
  // comprometido con otra orden.
  const available = round4(currentQuantity - reservedQuantity);

  const quantity = parseQuantity(value);
  const remainder = quantity === null ? null : round4(available - quantity);
  const isTooMuch = quantity !== null && quantity > available;

  async function handleSubmit() {
    if (quantity === null || quantity <= 0) {
      toast.error("Escribe cuántos metros vas a cortar.");
      return;
    }

    setIsSubmitting(true);
    const result = await runAction(() => cutLotAction({ lotId, quantity: String(quantity) }));
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`Corte de ${formatQuantity(quantity, { unit: unitLabel })} registrado`);
    setValue("");
    setOpen(false);
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setValue("");
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      title={`Cortar ${lotCode}`}
      description={`Disponible: ${formatQuantity(available, { unit: unitLabel })}`}
    >
      <div className="flex flex-col gap-4">
        {/* El número ocupa el centro y va enorme: se teclea de pie, con una
            mano, y hay que poder verificarlo sin acercarse el teléfono. */}
        <div className="flex items-baseline justify-center gap-2 border-b border-border pb-4">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="0"
            aria-label="Cantidad a cortar"
            className="tabular w-full min-w-0 bg-transparent text-center text-3xl font-semibold outline-none placeholder:text-muted-foreground"
          />
          <span className="shrink-0 text-lg text-muted-foreground">
            {unitLabel}
          </span>
        </div>

        {/* Atajos: la mayoría de los cortes son "todo lo que queda" o media
            pieza, y teclear el número exacto con guantes es lento. */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            onClick={() => setValue(String(available))}
          >
            Todo
          </Button>
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            onClick={() => setValue(String(round4(available / 2)))}
          >
            Mitad
          </Button>
        </div>

        <div className="flat-surface flex items-center justify-between p-3">
          <span className="text-sm text-muted-foreground">Queda</span>
          {/* Un remanente negativo no significa nada en la bodega: si se
              pidió de más, se dice así en vez de mostrar "-9,724 m". */}
          <span className="tabular text-lg font-semibold">
            {isTooMuch ? (
              <span className="text-destructive">No alcanza</span>
            ) : (
              formatQuantity(remainder ?? available, { unit: unitLabel })
            )}
          </span>
        </div>

        {isTooMuch && (
          <p className="text-sm text-destructive">
            Sólo hay {formatQuantity(available, { unit: unitLabel })} disponibles.
          </p>
        )}

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || isTooMuch || quantity === null || quantity <= 0}
          className="h-14 w-full text-base"
        >
          <Scissors className="size-5" aria-hidden />
          {isSubmitting ? "Registrando…" : "Confirmar corte"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}

/** Acepta coma decimal: así se escribe en México y así lo ofrece el teclado. */
function parseQuantity(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
