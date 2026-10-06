"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeCuttingBatchAction } from "@/app/actions/cutting-order.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  orderId: string;
  batchId: string;
  /** "3er corte", ya resuelto: es lo que se lee en la confirmación. */
  label: string;
  /** Piezas netas del corte, para decir con el número enfrente qué se pierde. */
  pieces: number;
}

/**
 * Borra un corte que se capturó de más.
 *
 * Pide motivo siempre: en el servidor es una baja HIGH y la bitácora no la
 * acepta sin explicación, así que se pide aquí en vez de dejar que el
 * guardado reviente con un error que no se resuelve desde la pantalla.
 */
export function BatchDeleteButton({ orderId, batchId, label, pieces }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!reason.trim()) {
      toast.error("Escribe por qué se borra este corte.");
      return;
    }

    setIsDeleting(true);
    const result = await runAction(() =>
      removeCuttingBatchAction({ orderId, batchId, reason: reason.trim() }),
    );
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`${label} borrado`);
    setOpen(false);
    setReason("");
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setReason("");
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Borrar ${label}`}
      description={`Se borra con sus ${pieces} piezas y lo cortado de cada talla baja en esa cantidad. No se puede deshacer.`}
      trigger={
        <Button
          variant="outline"
          className="touch-target w-full text-destructive sm:w-auto"
        >
          <Trash2 className="size-4" aria-hidden />
          Borrar corte
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`delete-batch-${batchId}`}>Motivo</Label>
          <Textarea
            id={`delete-batch-${batchId}`}
            rows={2}
            autoFocus
            placeholder="Se capturó de más, era el mismo tendido del 2º corte…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <Button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting || !reason.trim()}
          className="h-12 w-full bg-destructive text-white hover:bg-destructive/90"
        >
          {isDeleting ? "Borrando…" : "Sí, borrar el corte"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
