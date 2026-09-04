"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { createGarmentShipmentAction } from "@/app/actions/garment-shipment.actions";
import { runAction } from "@/lib/offline/run-action";
import { sumBundlePieces, sumBundles } from "@/lib/bundles";
import { todayInputValue } from "@/lib/utils";
import { FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  emptyRow,
  SizeBundleRows,
  usableRows,
  type SizeBundleRow,
} from "@/components/orders/size-bundle-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Una talla que se puede mandar: las que la orden pidió.
 *
 * Sin renglón en la orden esas piezas no aparecerían en su tablero ni en los
 * saldos por etapa —se irían al taller y no estarían en ningún lado—, así que
 * una talla nueva se agrega a la orden y sólo después se manda.
 */
export interface ShippableSize {
  sizeId: string;
  sizeCode: string;
  sizeName: string;
  /** Piezas que salieron del corte. La referencia contra la que se compara. */
  cut: number;
  /** Lo ya mandado a cada etapa, por id de etapa. */
  sentByStage: Record<string, number>;
}

/** Un bulto ya capturado que se copia al abrir el diálogo. */
export interface ShipmentPrefillRow {
  sizeId: string;
  /** Piezas POR BULTO, igual que en la captura del corte. */
  quantity: number;
  bundles: number;
}

/** El corte del que se copian los bultos. */
export interface ShipmentBatchPrefill {
  /** Cómo se llama en pantalla: "Corte 1", "Corte 2 · muestra". */
  label: string;
  rows: ShipmentPrefillRow[];
  /** Lo que el corte tiene NETO, correcciones incluidas. Para poder avisar. */
  netPieces: number;
}

interface Props {
  orderId: string;
  orderCode: string;
  sizes: ShippableSize[];
  workshops: { id: string; name: string }[];
  stages: { id: string; name: string }[];
  /**
   * Los bultos de un corte, precargados.
   *
   * Es el atajo que pidió el piso: lo que se manda al taller son casi siempre
   * LOS MISMOS bultos que salieron del tendido, y volver a teclear diez
   * renglones que ya están capturados es trabajo doble y la vía más corta a un
   * error de dedo. Se copian tal cual —talla, piezas por bulto y número de
   * bultos— y desde ahí se corrigen o se agregan más.
   *
   * Sin esto viaja un renglón vacío, que es el alta desde cero de siempre.
   */
  batch?: ShipmentBatchPrefill;
  /** Para meter el botón dentro de la tarjeta de un corte. */
  trigger?: React.ReactNode;
}

/**
 * Los renglones con los que abre el diálogo.
 *
 * Un corte sin bultos copiables cae en el renglón vacío en vez de dejar la
 * lista en blanco: el bloque sin tarjetas obliga a buscar el botón "Agregar
 * talla" antes de poder teclear nada.
 */
function initialRows(batch?: ShipmentBatchPrefill): SizeBundleRow[] {
  if (!batch || batch.rows.length === 0) return [emptyRow()];

  return batch.rows.map((row) => ({
    key: crypto.randomUUID(),
    value: row.sizeId,
    quantity: String(row.quantity),
    bundles: String(row.bundles),
  }));
}

/**
 * Manda prendas ya cortadas a un taller.
 *
 * Se captura BULTO POR BULTO, un renglón cada uno, porque así es como sale el
 * camión y como el taller cuenta lo que recibe: de la 43 suben un bulto de 30
 * y otro de 20, y esos son dos renglones aunque sean la misma talla. Con un
 * solo número por talla había que promediarlos a mano y el desglose se perdía
 * antes de llegar al vale que el taller firma.
 *
 * Junto a cada renglón se enseña lo ya mandado A ESA ETAPA, no un "disponible"
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
  batch,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workshopId, setWorkshopId] = useState("");
  const [stageId, setStageId] = useState("");
  const [sentAt, setSentAt] = useState(todayInputValue());
  const [parts, setParts] = useState("");
  const [reference, setReference] = useState("");
  const [rows, setRows] = useState<SizeBundleRow[]>(() => initialRows(batch));
  const [isSaving, setIsSaving] = useState(false);

  /* Lo que de verdad se copió, para poder compararlo con el neto del corte.
     No se asume igual: un corte con una corrección en negativo vale menos que
     la suma de sus bultos positivos, y callarlo mandaría de más al taller. */
  const copied = batch ? sumBundlePieces(batch.rows) : 0;

  const captured = usableRows(rows).filter((row) => row.quantity > 0);
  const total = sumBundlePieces(captured);
  const bundles = sumBundles(captured);

  const bySize = new Map(sizes.map((size) => [size.sizeId, size]));

  /* Contra lo CORTADO y sólo de la etapa elegida: es la pregunta real —"¿cuánto
     de la 34 me falta por mandar a bordado?"— y no cuántas prendas quedan en
     bodega. */
  function hintFor(sizeId: string) {
    const size = bySize.get(sizeId);
    if (!size) return null;

    const alreadySent = stageId ? (size.sentByStage[stageId] ?? 0) : 0;
    const sending = sumBundlePieces(
      captured.filter((row) => row.value === sizeId),
    );

    const bits = [`${size.cut} cortadas`];
    if (alreadySent > 0) bits.push(`ya van ${alreadySent}`);
    if (sending > 0) bits.push(`ahora ${sending}`);

    return bits.join(" · ");
  }

  /* Vuelve a los bultos del corte, no a la nada: el diálogo de un corte existe
     para ofrecerlos, y dejarlo vacío después de guardar lo convertiría en el
     alta desde cero de la que se quería salir. */
  function reset() {
    setRows(initialRows(batch));
    setReference("");
    setParts("");
  }

  async function handleSave() {
    if (!workshopId || !stageId) {
      toast.error("Elige el taller y la etapa.");
      return;
    }

    if (captured.length === 0) {
      toast.error("Agrega al menos un bulto con su talla y su cantidad.");
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
        lines: captured.map((row) => ({
          sizeId: row.value,
          sentQuantity: row.quantity,
          bundles: row.bundles,
        })),
      }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Envío registrado. Se creó su vale de salida en borrador.");
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Mandar a taller · ${batch ? batch.label : orderCode}`}
      description="Prendas ya cortadas que salen a un proceso. No mueve tela."
      trigger={
        trigger ?? (
          <Button variant="outline" className="touch-target">
            <Send className="size-4" aria-hidden />
            Mandar a taller
          </Button>
        )
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

          {/* Qué se copió y de dónde. Se dice en pantalla porque los renglones
              aparecen llenos sin que nadie los haya tecleado, y sin esta línea
              parecen capturados por otra persona. */}
          {batch && batch.rows.length > 0 && (
            <p className="border border-border bg-muted p-2 text-xs">
              Se copiaron los {batch.rows.length}{" "}
              {batch.rows.length === 1 ? "bulto" : "bultos"} del {batch.label}.
              Cambia lo que no vaya y agrega lo que falte.
              {copied !== batch.netPieces && (
                <>
                  {" "}
                  <span className="font-medium">
                    Ojo: el corte quedó en {batch.netPieces}{" "}
                    {batch.netPieces === 1 ? "pieza" : "piezas"} por
                    correcciones capturadas después, y aquí van {copied}.
                  </span>
                </>
              )}
            </p>
          )}

          {/* Se ofrecen TODAS las tallas de la orden, incluso las que aún no
              tienen corte capturado: el conteo del corte no siempre está al
              día y el camión no espera a que alguien lo teclee. */}
          <SizeBundleRows
            label="Bultos que van"
            options={sizes.map((size) => ({
              value: size.sizeId,
              code: size.sizeCode,
              hint: size.sizeName,
              keywords: size.sizeName,
            }))}
            rows={rows}
            onChange={setRows}
            renderHint={hintFor}
            footnote="La misma talla se puede repetir: un bulto de 30 y otro de 20 son dos renglones, y así salen en el vale."
          />

          {captured.length > 0 && (
            <p className="tabular border border-border bg-muted p-2 text-sm">
              {total} piezas · {bundles} {bundles === 1 ? "bulto" : "bultos"}
            </p>
          )}

          <SubmitButton
            isSubmitting={isSaving}
            onClick={handleSave}
            disabled={captured.length === 0}
            className="h-12 w-full"
          >
            Registrar envío
          </SubmitButton>
        </div>
      )}
    </ResponsiveFormDialog>
  );
}
