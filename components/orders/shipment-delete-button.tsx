"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { removeGarmentShipmentAction } from "@/app/actions/garment-shipment.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  shipmentId: string;
  shipmentCode: string;
  /** Piezas que salieron, sumando todas las tallas. */
  sentQuantity: number;
  /** Ya se capturó algún retorno: borrarlo también tira ese historial. */
  hasReturns: boolean;
  /** El vale que generó, para decir qué va a pasar con él. */
  voucher: { code: string; isDraft: boolean } | null;
}

/**
 * Borra un envío capturado por error.
 *
 * El caso es el dedazo: el taller equivocado, la etapa equivocada, la cantidad
 * de otra talla. Eso no es historia del taller —es basura— y dejarlo cancelado
 * para siempre ensucia la ficha de la orden.
 *
 * El diálogo dice ANTES de apretar qué pasa con el vale, porque es la parte
 * que no se adivina: si sigue en borrador se cancela junto con el envío, y si
 * ya se aplicó se queda, porque deshacer un documento aplicado es una decisión
 * de quien mira el kárdex y no un efecto secundario de corregir una captura.
 */
export function ShipmentDeleteButton({
  shipmentId,
  shipmentCode,
  sentQuantity,
  hasReturns,
  voucher,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await runAction(() =>
      removeGarmentShipmentAction({ id: shipmentId }),
    );
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(
      result.data.voucherCancelled
        ? `Envío eliminado y vale ${result.data.voucherCode} cancelado`
        : "Envío eliminado",
    );
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Borrar ${shipmentCode}`}
      description={`Se borra el registro de las ${sentQuantity} piezas que salieron. No se puede deshacer.`}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target shrink-0 text-muted-foreground"
          aria-label={`Borrar el envío ${shipmentCode}`}
        >
          <X className="size-4" aria-hidden />
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {hasReturns && (
          <p className="flat-surface p-3 text-sm text-muted-foreground">
            Este envío ya tiene retornos capturados. Se van con él: si el taller
            de verdad te devolvió esas piezas, esa cuenta se pierde.
          </p>
        )}

        {voucher && (
          <p className="flat-surface p-3 text-sm text-muted-foreground">
            {voucher.isDraft
              ? `Su vale ${voucher.code} está en borrador y se cancela junto con el envío.`
              : `Su vale ${voucher.code} ya se aplicó y NO se toca. Si también estuvo mal, cancélalo tú desde Salidas.`}
          </p>
        )}

        <Button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-12 w-full bg-destructive text-white hover:bg-destructive/90"
        >
          {isDeleting ? "Borrando…" : "Sí, borrar el envío"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
