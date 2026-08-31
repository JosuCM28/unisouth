"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeCuttingOrderAction } from "@/app/actions/cutting-order.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  orderId: string;
  orderCode: string;
  /** Piezas ya cortadas. Decide qué tan fuerte se advierte antes de borrar. */
  cutQuantity: number;
  className?: string;
}

/**
 * Borra una orden desde la lista.
 *
 * Pide confirmación siempre, y cuando la orden ya lleva piezas cortadas lo
 * dice con el número enfrente: eso es historial de taller que no se puede
 * reconstruir, y quien está limpiando la lista casi nunca sabe de memoria
 * cuál de las órdenes ya se trabajó.
 */
export function OrderDeleteButton({
  orderId,
  orderCode,
  cutQuantity,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasProgress = cutQuantity > 0;

  async function handleDelete() {
    setIsDeleting(true);
    const result = await runAction(() =>
      removeCuttingOrderAction({ id: orderId }),
    );
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Orden eliminada");
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Borrar ${orderCode}`}
      description={
        hasProgress
          ? `Esta orden ya lleva ${cutQuantity} piezas cortadas. Se borra con todo y su historial de cortes, y eso no se puede deshacer.`
          : "Se borra la orden con todas sus tallas. No se puede deshacer."
      }
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className={cn("touch-target shrink-0 text-muted-foreground", className)}
          aria-label={`Borrar ${orderCode}`}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Se ofrece la salida de en medio: casi siempre lo que se quiere es
            que la orden deje de estorbar, no que desaparezca el papel. */}
        {hasProgress && (
          <p className="flat-surface p-3 text-sm text-muted-foreground">
            Si lo que quieres es que deje de estorbar sin perder lo cortado,
            cancélala desde su ficha en vez de borrarla.
          </p>
        )}

        <Button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-12 w-full bg-destructive text-white hover:bg-destructive/90"
        >
          {isDeleting ? "Borrando…" : "Sí, borrar la orden"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
