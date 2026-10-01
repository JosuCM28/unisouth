"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sendFolderSplitToWorkshopAction } from "@/app/actions/order-folder.actions";
import { runAction } from "@/lib/offline/run-action";
import { sumBundlePieces, sumBundles } from "@/lib/bundles";
import { todayInputValue } from "@/lib/utils";
import type { SplitBundle } from "@/lib/workshop-split";
import { FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  folderId: string;
  folderCode: string;
  /** Qué lado del reparto es: "40%". Sólo para titular el diálogo. */
  sideLabel: string;
  /** Los bultos de ESE lado, con la orden y la talla de cada uno. */
  bundles: SplitBundle[];
  workshops: { id: string; name: string }[];
  stages: { id: string; name: string }[];
}

/**
 * Manda a un taller los bultos de UN lado del reparto del pedido.
 *
 * Los bultos no se editan aquí: ya salieron de un cálculo y retocarlos a mano
 * deshace el porcentaje. Si hace falta cambiar uno, se corrige el reparto
 * (porcentaje o cortes elegidos) y se vuelve a abrir. Nace un envío por orden.
 */
export function FolderSplitShipmentDialog({
  folderId,
  folderCode,
  sideLabel,
  bundles,
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

  // Sólo lo que sabemos a qué orden y talla pertenece: el servidor lo exige.
  const sendable = bundles.filter(
    (bundle) =>
      (bundle.parts?.length ?? 0) > 0 || (bundle.sizeId && bundle.orderId),
  );
  const rows = sendable.map((bundle) => ({
    quantity: bundle.pieces,
    bundles: bundle.count,
  }));
  const lines = sendable.flatMap(toShipmentLines);

  async function handleSave() {
    if (!workshopId || !stageId) {
      toast.error("Elige el taller y la etapa.");
      return;
    }

    setIsSaving(true);
    const result = await runAction(() =>
      sendFolderSplitToWorkshopAction({
        id: folderId,
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

    toast.success("Envíos registrados. Cada uno tiene su vale en borrador.");
    setOpen(false);
    setParts("");
    setReference("");
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Mandar ${sideLabel} a taller · ${folderCode}`}
      description="Sólo los bultos de este lado del reparto. No mueve tela."
      trigger={
        <Button
          variant="outline"
          disabled={sendable.length === 0}
          className="touch-target w-full"
        >
          <Send className="size-4" aria-hidden />
          Mandar {sideLabel}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelectField id="split-workshop" label="Taller">
          <SearchSelect
            id="split-workshop"
            options={workshops.map((w) => ({ value: w.id, label: w.name }))}
            value={workshopId}
            onChange={setWorkshopId}
            placeholder="Elige el taller"
            searchPlaceholder="Buscar taller…"
          />
        </FormSelectField>

        <FormSelectField id="split-stage" label="Etapa">
          <SearchSelect
            id="split-stage"
            options={stages.map((s) => ({ value: s.id, label: s.name }))}
            value={stageId}
            onChange={setStageId}
            placeholder="Elige la etapa"
            searchPlaceholder="Buscar etapa…"
          />
        </FormSelectField>

        <div className="flex flex-col gap-2">
          <Label htmlFor="split-parts">Qué partes van</Label>
          <Input
            id="split-parts"
            placeholder="Tapas y delantero izquierdo"
            value={parts}
            onChange={(event) => setParts(event.target.value)}
            className="touch-target"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="split-date">Fecha de salida</Label>
            <Input
              id="split-date"
              type="date"
              value={sentAt}
              onChange={(event) => setSentAt(event.target.value)}
              className="touch-target"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="split-reference">Referencia</Label>
            <Input
              id="split-reference"
              placeholder="Su folio"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className="touch-target"
            />
          </div>
        </div>

        <ul className="flex flex-col border border-border text-sm">
          {sendable.map((bundle, index) => (
            <li
              key={index}
              className="tabular flex justify-between gap-2 border-b border-border px-2 py-1 last:border-b-0"
            >
              <span>
                Talla {bundle.sizeCode}
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · {describeOwners(bundle)}
                </span>
              </span>
              <span>
                {bundle.count}×{bundle.pieces}
              </span>
            </li>
          ))}
        </ul>

        <p className="tabular border border-border bg-muted p-2 text-sm">
          {sumBundlePieces(rows)} piezas · {sumBundles(rows)} bultos
        </p>

        <SubmitButton
          isSubmitting={isSaving}
          onClick={handleSave}
          disabled={sendable.length === 0}
          className="h-12 w-full"
        >
          Registrar envíos
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}

/**
 * Los renglones de envío de un bulto: uno por orden.
 *
 * Un bulto de corte global que el reparto partió entre dos órdenes viaja
 * ENTERO en el camión, pero cada orden lleva su cuenta de lo que mandó al
 * taller, así que en el papel va su parte en cada envío.
 */
function toShipmentLines(bundle: SplitBundle) {
  const base = {
    bundles: bundle.count,
    tagId: bundle.tagId ?? undefined,
  };

  if (bundle.parts && bundle.parts.length > 0) {
    return bundle.parts.map((part) => ({
      ...base,
      orderId: part.orderId,
      sizeId: part.sizeId,
      sentQuantity: part.pieces,
      notes: part.note ?? undefined,
    }));
  }

  return [
    {
      ...base,
      orderId: bundle.orderId,
      sizeId: bundle.sizeId,
      sentQuantity: bundle.pieces,
      notes: bundle.note ?? undefined,
    },
  ];
}

/** "PO-2026-0109" o "PO-2026-0109: 60 · PO-2026-0126: 41". */
function describeOwners(bundle: SplitBundle): string {
  if (!bundle.parts || bundle.parts.length === 0) return bundle.orderCode ?? "";
  if (bundle.parts.length === 1) return bundle.parts[0]!.orderCode;

  return bundle.parts.map((part) => `${part.orderCode}: ${part.pieces}`).join(" · ");
}
