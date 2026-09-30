"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { Unit } from "@prisma/client";
import { returnOrderFabricAction } from "@/app/actions/order-fabric.actions";
import { runAction } from "@/lib/offline/run-action";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatQuantity } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Un rollo que la orden todavía tiene afuera. */
export interface ReturnableRoll {
  lotId: string;
  lotCode: string;
  materialName: string;
  shade: string | null;
  unit: Unit;
  /** Lo que salió y no ha regresado: el tope de lo que se puede devolver. */
  pending: number;
}

interface Props {
  orderId: string;
  orderCode: string;
  rolls: ReturnableRoll[];
}

/**
 * Registra cuánta tela regresó de la orden.
 *
 * Sólo ofrece los rollos que la orden se llevó y aún no devuelve, cada uno
 * con su tope: lo que se pueda regresar nunca pasa de lo que salió. Se captura
 * sólo lo que volvió; un rollo en blanco no se devuelve.
 */
export function OrderFabricReturnDialog({ orderId, orderCode, rolls }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Texto y no número: el input vive a medio teclear.
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  async function handleSave() {
    const lines = rolls
      .map((roll) => ({
        roll,
        quantity: Number(amounts[roll.lotId]?.replace(",", ".") ?? 0),
      }))
      .filter((line) => line.quantity > 0);

    if (lines.length === 0) {
      toast.error("Captura cuánto regresó de al menos un rollo.");
      return;
    }

    const over = lines.find((line) => line.quantity > line.roll.pending);
    if (over) {
      toast.error(
        `Del rollo ${over.roll.lotCode} sólo quedan ${formatQuantity(over.roll.pending)} por regresar.`,
      );
      return;
    }

    setIsSaving(true);
    const result = await runAction(() =>
      returnOrderFabricAction({
        orderId,
        lines: lines.map((line) => ({
          lotId: line.roll.lotId,
          quantity: line.quantity,
        })),
        notes: notes || undefined,
      }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Devolución registrada");
    setOpen(false);
    setAmounts({});
    setNotes("");
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Devolución de tela de ${orderCode}`}
      description="Captura lo que regresó de cada rollo. Vuelve al saldo del mismo rollo y queda en el kárdex."
      trigger={
        <Button variant="outline" className="touch-target">
          <Undo2 className="size-4" aria-hidden />
          Devolver tela
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {rolls.map((roll) => {
            const unit = UNIT_SHORT_LABELS[roll.unit];

            return (
              <li
                key={roll.lotId}
                className="flat-surface flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="tabular text-sm font-medium">{roll.lotCode}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {roll.materialName}
                    {roll.shade && ` · tono ${roll.shade}`}
                  </p>
                  <p className="tabular text-xs text-muted-foreground">
                    Pendiente: {formatQuantity(roll.pending, { unit })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Input
                    inputMode="decimal"
                    aria-label={`Regresó del rollo ${roll.lotCode}`}
                    placeholder="0"
                    className="tabular touch-target w-24 text-right"
                    value={amounts[roll.lotId] ?? ""}
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [roll.lotId]: event.target.value,
                      }))
                    }
                  />
                  <span className="text-xs text-muted-foreground">{unit}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fabric-return-notes">Notas (opcional)</Label>
          <Input
            id="fabric-return-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="touch-target"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="touch-target"
        >
          {isSaving ? "Guardando…" : "Registrar devolución"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
