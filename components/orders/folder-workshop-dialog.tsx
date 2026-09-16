"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sendFolderToWorkshopAction } from "@/app/actions/order-folder.actions";
import { runAction } from "@/lib/offline/run-action";
import { todayInputValue } from "@/lib/utils";
import type { PreviewSize } from "@/lib/folder-send-preview";
import { FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  folderId: string;
  folderCode: string;
  /** Todo lo cortado del pedido, junto por talla. */
  sizes: PreviewSize[];
  pieces: number;
  bundles: number;
  /** De cuántas órdenes sale. Nacerá un envío por cada una. */
  orders: number;
  /** Órdenes sin nada cortado. Se avisan, no se mandan. */
  skippedOrders: string[];
  workshops: { id: string; name: string }[];
  stages: { id: string; name: string }[];
}

/**
 * EL ENVÍO GLOBAL A TALLER: todo el pedido al mismo proceso, de un jalón.
 *
 * Taller, proceso, partes y fecha se eligen UNA vez y nace un envío por orden,
 * cada uno con su folio y su vale. No es un solo papel a propósito: los
 * retornos del taller se cuentan contra la orden, y un envío que no supiera de
 * qué orden salió cada talla dejaría esa cuenta sin contra qué cuadrarse.
 *
 * A diferencia de la salida global, esto SÍ se repite. Lo que sale al taller
 * son paneles: las mismas piezas van a bordado y después a armado, y cada
 * etapa lleva su propia cuenta.
 */
export function FolderWorkshopDialog({
  folderId,
  folderCode,
  sizes,
  pieces,
  bundles,
  orders,
  skippedOrders,
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
  const [isSaving, setIsSaving] = useState(false);

  async function handleSend() {
    if (!workshopId || !stageId) {
      toast.error("Elige el taller y la etapa.");
      return;
    }

    setIsSaving(true);
    const result = await runAction(() =>
      sendFolderToWorkshopAction({
        id: folderId,
        workshopId,
        stageId,
        sentAt,
        parts: parts || undefined,
        reference: reference || undefined,
      }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const count = result.data.shipments.length;
    toast.success(
      `${count} ${count === 1 ? "envío registrado" : "envíos registrados"}. Cada uno levantó su vale en borrador.`,
    );
    setOpen(false);
    setParts("");
    setReference("");
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Mandar el pedido a taller · ${folderCode}`}
      description="Todas las órdenes al mismo proceso. Nace un envío por orden, con su vale. No mueve tela."
      trigger={
        <Button variant="outline" className="touch-target">
          <Send className="size-4" aria-hidden />
          Taller global
        </Button>
      }
    >
      {sizes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este pedido todavía no tiene piezas cortadas que mandar al taller.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <FormSelectField id="folder-workshop" label="Taller">
            <SearchSelect
              id="folder-workshop"
              options={workshops.map((w) => ({ value: w.id, label: w.name }))}
              value={workshopId}
              onChange={setWorkshopId}
              placeholder="Elige el taller"
              searchPlaceholder="Buscar taller…"
            />
          </FormSelectField>

          <FormSelectField
            id="folder-stage"
            label="Etapa"
            hint="Para qué va: bordado, armado, lavado."
          >
            <SearchSelect
              id="folder-stage"
              options={stages.map((s) => ({ value: s.id, label: s.name }))}
              value={stageId}
              onChange={setStageId}
              placeholder="Elige la etapa"
              searchPlaceholder="Buscar etapa…"
            />
          </FormSelectField>

          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-parts">Qué partes van</Label>
            <Input
              id="folder-parts"
              placeholder="Tapas y delantero izquierdo"
              value={parts}
              onChange={(event) => setParts(event.target.value)}
              className="touch-target"
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Sale impreso en cada vale, debajo del taller.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="folder-sent-at">Fecha de salida</Label>
              <Input
                id="folder-sent-at"
                type="date"
                value={sentAt}
                onChange={(event) => setSentAt(event.target.value)}
                className="touch-target"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="folder-reference">Referencia</Label>
              <Input
                id="folder-reference"
                placeholder="Su folio"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="touch-target"
              />
            </div>
          </div>

          <div className="flat-surface p-3">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">Van a salir</span>
              <span className="tabular text-sm">
                {pieces} {pieces === 1 ? "pieza" : "piezas"} · {bundles}{" "}
                {bundles === 1 ? "bulto" : "bultos"}
              </span>
            </div>

            <ul className="flex flex-col gap-1">
              {sizes.map((size) => (
                <li
                  key={size.sizeId}
                  className="tabular flex items-baseline justify-between gap-3 text-xs text-muted-foreground"
                >
                  <span>Talla {size.sizeCode}</span>
                  <span>
                    {size.pieces} · {size.bundles}{" "}
                    {size.bundles === 1 ? "bulto" : "bultos"}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
              Nacen {orders} {orders === 1 ? "envío" : "envíos"}, uno por orden,
              cada uno con su folio y su vale.
            </p>
          </div>

          {/* Las órdenes sin corte no se callan: quien manda el pedido completo
              espera que vaya completo. */}
          {skippedOrders.length > 0 && (
            <p className="border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
              {skippedOrders.length === 1
                ? "Una orden no lleva piezas cortadas y no se manda"
                : `${skippedOrders.length} órdenes no llevan piezas cortadas y no se mandan`}
              : <span className="tabular">{skippedOrders.join(" · ")}</span>.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Va TODO lo cortado del pedido, se haya mandado antes o no: lo que
            sale al taller son paneles, y las mismas piezas pasan por bordado y
            después por armado. Cada etapa lleva su propia cuenta.
          </p>

          <Button
            type="button"
            onClick={handleSend}
            disabled={isSaving}
            className="h-12 w-full"
          >
            <Send className="size-4" aria-hidden />
            {isSaving ? "Registrando…" : "Mandar el pedido al taller"}
          </Button>
        </div>
      )}
    </ResponsiveFormDialog>
  );
}
