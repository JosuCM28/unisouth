"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cutProgress } from "@/lib/utils";
import { addCuttingProgressAction } from "@/app/actions/cutting-order.actions";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  lineId: string;
  sizeCode: string;
  ordered: number;
  cut: number;
  trigger: ReactNode;
}

/**
 * Registra cuántas piezas se cortaron de una talla.
 *
 * Se captura el AVANCE del rato, no el acumulado: quien acaba de cortar sabe
 * que sacó 40, no que el total ahora va en 190. Pedirle la suma invita a
 * equivocarse y borra el rastro de cuándo se hizo cada tanda.
 */
export function OrderProgressDialog({
  lineId,
  sizeCode,
  ordered,
  cut,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { pending, surplus } = cutProgress(ordered, cut);
  const typed = Number(quantity) || 0;

  async function handleSave() {
    if (typed === 0) {
      toast.error("Escribe cuántas piezas se cortaron.");
      return;
    }

    setIsSaving(true);
    const result = await addCuttingProgressAction({
      lineId,
      quantity: typed,
      notes: notes || undefined,
    });
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`Talla ${sizeCode}: ${typed > 0 ? "+" : ""}${typed} piezas`);
    setOpen(false);
    setQuantity("");
    setNotes("");
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuantity("");
      setNotes("");
    }
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Avance de la talla ${sizeCode}`}
      description={`Pedidas ${ordered} · cortadas ${cut} · ${
        surplus > 0 ? `sobran ${surplus}` : `faltan ${pending}`
      }`}
      trigger={trigger}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="progress-quantity">Piezas cortadas ahora</Label>
          <Input
            id="progress-quantity"
            inputMode="numeric"
            autoFocus
            placeholder="40"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="tabular touch-target h-12 text-right text-lg"
          />
          <p className="text-xs text-muted-foreground">
            Se suma a lo ya cortado. Para corregir un conteo de más, escribe un
            número negativo.
          </p>
        </div>

        {/* Se avisa, no se bloquea: cortar de más pasa y el sistema debe
            poder registrarlo en vez de obligar a falsear el número. */}
        {typed > 0 && cut + typed > ordered && (
          <p className="border border-border bg-muted p-2 text-xs">
            Con este avance la talla quedaría en {cut + typed} de {ordered}{" "}
            pedidas: sobran {cut + typed - ordered}.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="progress-notes">Notas</Label>
          <Textarea
            id="progress-notes"
            rows={2}
            placeholder="Quién cortó, en qué mesa…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || typed === 0}
          className="h-12 w-full"
        >
          {isSaving ? "Guardando…" : "Registrar avance"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
