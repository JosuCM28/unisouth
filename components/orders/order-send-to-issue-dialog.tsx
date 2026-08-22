"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import { sendOrderToIssueAction } from "@/app/actions/cutting-order.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";

interface SizePreview {
  sizeCode: string;
  quantity: number;
}

interface Props {
  orderId: string;
  orderCode: string;
  /** Tallas que van a viajar, ya filtradas: sólo las que tienen corte. */
  sizes: SizePreview[];
  /** Tallas pedidas sin nada cortado. Se avisan, no se mandan. */
  pendingSizes: number;
}

/**
 * Manda la orden a Salidas como borrador y lleva ahí al auxiliar.
 *
 * El paso que ahorra: la orden ya tiene cliente, tela y el desglose talla por
 * talla, y antes había que volver a capturarlo todo en el vale. Aquí se copia
 * lo que coincide y sólo queda completar lo que es propio de la salida.
 *
 * Muestra ANTES de crear nada qué tallas y cuántas piezas van a viajar: el
 * vale se crea de verdad, con su folio de la serie OUT, y enterarse después
 * de que salió con las tallas equivocadas obliga a cancelarlo.
 */
export function OrderSendToIssueDialog({
  orderId,
  orderCode,
  sizes,
  pendingSizes,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const total = sizes.reduce((sum, size) => sum + size.quantity, 0);

  async function handleSend() {
    setIsSaving(true);
    const result = await runAction(() => sendOrderToIssueAction({ id: orderId }));
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`Borrador ${result.data.code} creado`);
    setOpen(false);

    /* Se va derecho a editar el borrador y no al registro de salidas: lo que
       sigue es completar el vale —los rollos, quién recibe—, y dejarlo en la
       lista obligaría a buscarlo entre los demás. */
    router.push(`/issues/${result.data.id}/edit`);
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Enviar ${orderCode} a salidas`}
      description="Se crea un borrador de salida con el desglose ya capturado. No mueve inventario todavía."
      trigger={
        <Button variant="outline" className="touch-target">
          <Truck className="size-4" aria-hidden />
          Enviar a salidas
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flat-surface p-3">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">Van a viajar</span>
            <span className="tabular text-sm">
              {total} {total === 1 ? "prenda" : "prendas"}
            </span>
          </div>

          <ul className="flex flex-col gap-1">
            {sizes.map((size) => (
              <li
                key={size.sizeCode}
                className="tabular flex items-baseline justify-between gap-3 text-xs text-muted-foreground"
              >
                <span>Talla {size.sizeCode}</span>
                <span>{size.quantity}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Se dice de frente lo que NO va: si el auxiliar esperaba la orden
            completa, más vale que lo sepa antes de firmar el vale. */}
        {pendingSizes > 0 && (
          <p className="border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            {pendingSizes === 1
              ? "Una talla no lleva piezas cortadas y no se incluye."
              : `${pendingSizes} tallas no llevan piezas cortadas y no se incluyen.`}{" "}
            Cuando se corten, puedes mandar otra salida.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Se copian el cliente, la tela y las tallas cortadas. Los rollos que se
          descuentan y quién recibe se capturan en el vale.
        </p>

        <Button
          type="button"
          onClick={handleSend}
          disabled={isSaving}
          className="h-12 w-full"
        >
          <Truck className="size-4" aria-hidden />
          {isSaving ? "Creando borrador…" : "Crear borrador de salida"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
