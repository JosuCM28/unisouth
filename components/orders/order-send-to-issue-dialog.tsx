"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Truck } from "lucide-react";
import { toast } from "sonner";
import { sendOrderToIssueAction } from "@/app/actions/cutting-order.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";

interface SizePreview {
  sizeCode: string;
  quantity: number;
}

/** Una salida que la orden ya tiene y que sigue en pie. */
export interface LiveIssue {
  code: string;
  isDraft: boolean;
}

interface Props {
  orderId: string;
  orderCode: string;
  /** Tallas que van a viajar, ya filtradas: sólo las que tienen corte. */
  sizes: SizePreview[];
  /** Tallas pedidas sin nada cortado. Se avisan, no se mandan. Sólo aplica
   *  al mandar la orden completa. */
  pendingSizes?: number;
  /**
   * El corte que se manda. Sin él viaja TODO lo cortado de la orden.
   *
   * El taller no entrega la orden de una vez: entrega el primer tendido,
   * sigue cortando y entrega el segundo.
   */
  batch?: { id: string; label: string };
  /** Salidas vivas que la orden ya tiene. Se advierten antes de crear otra. */
  liveIssues?: LiveIssue[];
  /** Para meter el botón dentro de la tarjeta de un corte. */
  trigger?: React.ReactNode;
}

/**
 * Manda a Salidas —la orden entera o un corte— como borrador, y lleva ahí al
 * auxiliar.
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
  pendingSizes = 0,
  batch,
  liveIssues = [],
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const total = sizes.reduce((sum, size) => sum + size.quantity, 0);

  async function handleSend() {
    setIsSaving(true);
    const result = await runAction(() =>
      sendOrderToIssueAction({ id: orderId, batchId: batch?.id }),
    );
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
      title={
        batch
          ? `Enviar ${batch.label.toLowerCase()} a salidas`
          : `Enviar ${orderCode} a salidas`
      }
      description="Se crea un borrador de salida con el desglose ya capturado. No mueve inventario todavía."
      trigger={
        trigger ?? (
          <Button variant="outline" className="touch-target">
            <Truck className="size-4" aria-hidden />
            Enviar a salidas
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {/* Antes que nada: si la orden ya salió, hay que saberlo ANTES de
            firmar otro vale. Sin esto, mandar la orden completa dos veces
            entrega en el papel las mismas prendas dos veces. */}
        {liveIssues.length > 0 && (
          <p className="flex items-start gap-2 border border-state-reserved bg-card p-3 text-sm">
            <AlertTriangle
              className="size-4 shrink-0 text-state-reserved"
              aria-hidden
            />
            <span>
              Esta orden ya tiene{" "}
              {liveIssues.length === 1 ? "una salida" : "salidas"} sin cancelar:{" "}
              <span className="tabular font-medium">
                {liveIssues
                  .map(
                    (issue) =>
                      `${issue.code} (${issue.isDraft ? "borrador" : "aplicada"})`,
                  )
                  .join(" · ")}
              </span>
              . {batch ? "Revisa que este corte no vaya ya ahí." : "Lo que mandes ahora se suma a eso."}
            </span>
          </p>
        )}

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
        {!batch && pendingSizes > 0 && (
          <p className="border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            {pendingSizes === 1
              ? "Una talla no lleva piezas cortadas y no se incluye."
              : `${pendingSizes} tallas no llevan piezas cortadas y no se incluyen.`}{" "}
            Cuando se corten, puedes mandar otra salida.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Se copian el cliente, el encabezado del corte —prenda, tela, molde,
          versión y notas— y{" "}
          {batch
            ? "sólo las piezas de este corte, no lo cortado en los demás"
            : "las tallas cortadas"}
          . Los rollos que se descuentan y quién recibe se capturan en el vale.
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
