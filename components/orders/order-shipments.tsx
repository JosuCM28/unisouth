"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import type { GarmentShipmentStatus } from "@prisma/client";
import { addGarmentReturnAction } from "@/app/actions/garment-shipment.actions";
import { runAction } from "@/lib/offline/run-action";
import {
  GARMENT_SHIPMENT_STATUS_LABELS,
  GARMENT_SHIPMENT_STATUS_STYLES,
} from "@/lib/constants/labels";
import { cn, formatDate } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface ShipmentLineView {
  id: string;
  sizeCode: string;
  sentQuantity: number;
  returnedQuantity: number;
  scrapQuantity: number;
}

export interface ShipmentView {
  id: string;
  code: string;
  status: GarmentShipmentStatus;
  workshopName: string;
  stageName: string;
  sentAt: Date;
  reference: string | null;
  parts: string | null;
  /** El vale de salida que generó, para ir a imprimirlo o aplicarlo. */
  document: { id: string; code: string } | null;
  lines: ShipmentLineView[];
}

/**
 * Los envíos de una orden: qué salió, a qué etapa y con qué vale.
 *
 * Se listan del más nuevo al más viejo porque el que se consulta es el último.
 * Lo normal es que un envío se quede en "enviado" para siempre: el taller
 * borda los paneles y los manda a donde siguen, así que no vuelven aquí. El
 * botón de retorno sólo aparece cuando de verdad hace falta capturar uno.
 */
export function OrderShipments({ shipments }: { shipments: ShipmentView[] }) {
  if (shipments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no sale nada a taller. Cuando mandes prendas, aquí queda el
        registro de qué salió, a qué etapa y con qué vale.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {shipments.map((shipment) => (
        <li key={shipment.id} className="flat-surface flex flex-col gap-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular text-sm font-medium">
                  {shipment.code}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs",
                    GARMENT_SHIPMENT_STATUS_STYLES[shipment.status],
                  )}
                >
                  {GARMENT_SHIPMENT_STATUS_LABELS[shipment.status]}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {shipment.stageName} · {shipment.workshopName} ·{" "}
                {formatDate(shipment.sentAt)}
                {shipment.reference && ` · Ref. ${shipment.reference}`}
              </p>
              {shipment.parts && (
                <p className="truncate text-xs text-muted-foreground">
                  {shipment.parts}
                </p>
              )}
            </div>

            {/* El vale que se imprime y se firma. Va aquí porque es el papel
                que acompaña al bulto, no un detalle del registro. */}
            {shipment.document && (
              <Link
                href={`/documents/${shipment.document.id}`}
                className="touch-target flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground"
              >
                <FileText className="size-4" aria-hidden />
                <span className="tabular">{shipment.document.code}</span>
              </Link>
            )}
          </div>

          <ul className="flex flex-col gap-1">
            {shipment.lines.map((line) => {
              const pending =
                line.sentQuantity - line.returnedQuantity - line.scrapQuantity;
              const hasReturns =
                line.returnedQuantity > 0 || line.scrapQuantity > 0;

              return (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-3 border-t border-border pt-1 text-sm"
                >
                  <span className="tabular font-medium">{line.sizeCode}</span>

                  {/* Sin retornos sólo se dice qué salió, que es el caso
                      normal. Las otras cifras aparecen únicamente cuando
                      alguien capturó una devolución, para no llenar el
                      renglón de ceros que no significan nada. */}
                  <span className="tabular flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{line.sentQuantity} salieron</span>
                    {line.returnedQuantity > 0 && (
                      <span>{line.returnedQuantity} volvieron</span>
                    )}
                    {line.scrapQuantity > 0 && (
                      <span className="text-state-defective">
                        {line.scrapQuantity} merma
                      </span>
                    )}
                    {hasReturns && pending > 0 && (
                      <span className="font-medium text-foreground">
                        {pending} sin retorno
                      </span>
                    )}
                  </span>

                  {pending > 0 && shipment.status !== "CANCELLED" && (
                    <ReturnDialog
                      lineId={line.id}
                      sizeCode={line.sizeCode}
                      pending={pending}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/**
 * Captura lo que el taller devolvió de una talla.
 *
 * Separa lo que volvió bueno de la merma porque son dos hechos distintos: lo
 * primero se puede mandar a la siguiente etapa y lo segundo no vuelve nunca.
 * Sumarlas en un solo número haría que el saldo cerrara mintiendo.
 */
function ReturnDialog({
  lineId,
  sizeCode,
  pending,
}: {
  lineId: string;
  sizeCode: string;
  pending: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [scrap, setScrap] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const returned = Number(quantity) || 0;
    const lost = Number(scrap) || 0;

    if (returned === 0 && lost === 0) {
      toast.error("Captura cuántas regresaron o cuántas se perdieron.");
      return;
    }

    setIsSaving(true);
    const result = await runAction(() =>
      addGarmentReturnAction({
        lineId,
        quantity: returned,
        scrapQuantity: lost,
        notes: notes || undefined,
      }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Retorno registrado");
    setOpen(false);
    setQuantity("");
    setScrap("");
    setNotes("");
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Retorno de la talla ${sizeCode}`}
      description={`Salieron ${pending} piezas sin retorno. Captúralo sólo si el taller de verdad te las devolvió.`}
      trigger={
        <Button variant="outline" size="sm" className="touch-target shrink-0">
          Regresó
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="return-quantity">Regresaron bien</Label>
            <Input
              id="return-quantity"
              inputMode="numeric"
              placeholder={String(pending)}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="tabular touch-target text-right"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="return-scrap">Merma</Label>
            <Input
              id="return-scrap"
              inputMode="numeric"
              placeholder="0"
              value={scrap}
              onChange={(event) => setScrap(event.target.value)}
              className="tabular touch-target text-right"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="return-notes">Notas</Label>
          <Textarea
            id="return-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="5 salieron manchadas"
          />
        </div>

        <SubmitButton
          isSubmitting={isSaving}
          onClick={handleSave}
          className="h-12 w-full"
        >
          Registrar retorno
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}
