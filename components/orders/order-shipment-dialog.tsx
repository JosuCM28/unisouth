"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { createGarmentShipmentAction } from "@/app/actions/garment-shipment.actions";
import { runAction } from "@/lib/offline/run-action";
import { todayInputValue } from "@/lib/utils";
import { FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ShippableSize {
  sizeId: string;
  sizeCode: string;
  /** Piezas que salieron del corte. La referencia contra la que se compara. */
  cut: number;
  /** Lo ya mandado a cada etapa, por id de etapa. */
  sentByStage: Record<string, number>;
}

interface Props {
  orderId: string;
  orderCode: string;
  sizes: ShippableSize[];
  workshops: { id: string; name: string }[];
  stages: { id: string; name: string }[];
}

/**
 * Manda prendas ya cortadas a un taller.
 *
 * Se capturan TODAS las tallas en una sola pantalla porque así es como sale el
 * camión: se cargan los bultos que caben y se anota qué se fue. Obligar a un
 * envío por talla convertiría un viaje en cinco capturas.
 *
 * Junto a cada talla se enseña lo ya mandado A ESA ETAPA, no un "disponible"
 * global. Lo que sale a bordar son PANELES —tapas, delantero izquierdo— y los
 * demás paneles de esas mismas prendas siguen en la bodega: descontarlas de un
 * saldo único diría que ya no las tienes cuando sí. Por eso mandar 100 de la
 * 34 a bordado no te impide mandar esas mismas 100 a armado.
 *
 * Y por eso tampoco hay tope: el contador informa, no bloquea.
 */
export function OrderShipmentDialog({
  orderId,
  orderCode,
  sizes,
  workshops,
  stages,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workshopId, setWorkshopId] = useState("");
  const [stageId, setStageId] = useState("");
  const [sentAt, setSentAt] = useState(todayInputValue());
  const [parts, setParts] = useState("");
  const [reference, setReference] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  /* Se ofrecen TODAS las tallas de la orden, incluso las que aún no tienen
     corte capturado: el conteo del corte no siempre está al día y el camión no
     espera a que alguien lo teclee. */
  const total = Object.values(quantities).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );

  async function handleSave() {
    if (!workshopId || !stageId) {
      toast.error("Elige el taller y la etapa.");
      return;
    }

    const lines = sizes
      .map((size) => ({
        sizeId: size.sizeId,
        sentQuantity: Number(quantities[size.sizeId] ?? ""),
      }))
      .filter((line) => line.sentQuantity > 0);

    if (lines.length === 0) {
      toast.error("Captura cuántas piezas van de al menos una talla.");
      return;
    }

    setIsSaving(true);
    const result = await runAction(() =>
      createGarmentShipmentAction({
        orderId,
        workshopId,
        stageId,
        sentAt,
        parts: parts || undefined,
        reference: reference || undefined,
        lines,
      }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Envío registrado. Se creó su vale de salida en borrador.");
    setOpen(false);
    setQuantities({});
    setReference("");
    setParts("");
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Mandar a taller · ${orderCode}`}
      description="Prendas ya cortadas que salen a un proceso. No mueve tela."
      trigger={
        <Button variant="outline" className="touch-target">
          <Send className="size-4" aria-hidden />
          Mandar a taller
        </Button>
      }
    >
      {sizes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta orden no tiene tallas capturadas todavía.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <FormSelectField id="shipment-workshop" label="Taller">
            <SearchSelect
              id="shipment-workshop"
              options={workshops.map((w) => ({ value: w.id, label: w.name }))}
              value={workshopId}
              onChange={setWorkshopId}
              placeholder="Elige el taller"
              searchPlaceholder="Buscar taller…"
            />
          </FormSelectField>

          <FormSelectField
            id="shipment-stage"
            label="Etapa"
            hint="Para qué va: bordado, armado, lavado."
          >
            <SearchSelect
              id="shipment-stage"
              options={stages.map((s) => ({ value: s.id, label: s.name }))}
              value={stageId}
              onChange={setStageId}
              placeholder="Elige la etapa"
              searchPlaceholder="Buscar etapa…"
            />
          </FormSelectField>

          <div className="flex flex-col gap-2">
            <Label htmlFor="shipment-parts">Qué partes van</Label>
            <Input
              id="shipment-parts"
              placeholder="Tapas y delantero izquierdo"
              value={parts}
              onChange={(event) => setParts(event.target.value)}
              className="touch-target"
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Sale impreso en el vale, debajo del taller.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="shipment-date">Fecha de salida</Label>
              <Input
                id="shipment-date"
                type="date"
                value={sentAt}
                onChange={(event) => setSentAt(event.target.value)}
                className="touch-target"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="shipment-reference">Referencia</Label>
              <Input
                id="shipment-reference"
                placeholder="Su folio"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="touch-target"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Piezas por talla</Label>
              {total > 0 && (
                <span className="tabular text-sm text-muted-foreground">
                  {total} piezas
                </span>
              )}
            </div>

            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {sizes.map((size) => {
                const alreadySent = stageId
                  ? (size.sentByStage[stageId] ?? 0)
                  : 0;

                return (
                <li
                  key={size.sizeId}
                  className="flat-surface flex items-center gap-3 p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="tabular text-sm font-medium">
                      {size.sizeCode}
                    </p>
                    {/* Contra lo CORTADO y sólo de esta etapa: es la pregunta
                        real —"¿cuánto de la 34 me falta por mandar a
                        bordado?"— y no cuántas prendas quedan en bodega. */}
                    <p className="tabular text-xs text-muted-foreground">
                      {size.cut} cortadas
                      {alreadySent > 0 && ` · ya van ${alreadySent}`}
                    </p>
                  </div>

                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    value={quantities[size.sizeId] ?? ""}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [size.sizeId]: event.target.value,
                      }))
                    }
                    aria-label={`Piezas de la talla ${size.sizeCode}`}
                    className="tabular touch-target w-24 text-right"
                  />
                </li>
                );
              })}
            </ul>
          </div>

          <SubmitButton
            isSubmitting={isSaving}
            onClick={handleSave}
            className="h-12 w-full"
          >
            Registrar envío
          </SubmitButton>
        </div>
      )}
    </ResponsiveFormDialog>
  );
}
