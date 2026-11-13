"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sumBundlePieces, sumBundles } from "@/lib/bundles";
import { captureOfflineShipment } from "@/lib/offline/offline-order-captures";
import { sizeStageKey } from "@/lib/offline/pending-orders";
import type {
  OfflineCutTag,
  OfflineOrder,
  OfflineSize,
  OfflineStage,
  OfflineWorkshop,
} from "@/lib/offline/snapshot.types";
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
import {
  OfflineCaptureResult,
  toCaptureResult,
  type CaptureResult,
} from "./offline-capture-result";

interface Props {
  order: OfflineOrder;
  sizes: Map<string, OfflineSize>;
  tags: Map<string, OfflineCutTag>;
  workshops: OfflineWorkshop[];
  stages: OfflineStage[];
  /** Piezas cortadas pendientes de subir, por renglón de la orden. */
  pendingCut: Map<string, number>;
  /** Piezas enviadas pendientes de subir, por "talla:etapa". */
  pendingSent: Map<string, number>;
}

/**
 * Manda prendas cortadas a un taller SIN internet: el mismo envío que en
 * línea, bulto por bulto. El folio ENV y su vale los pone el servidor al
 * subir; aquí se queda con TMP.
 *
 * Igual que en línea, el contador de cada talla informa y no bloquea: el
 * camión no espera a que alguien capture el corte.
 */
export function OfflineShipmentDialog(props: Props) {
  const { order, sizes, tags, workshops, stages } = props;
  const [open, setOpen] = useState(false);
  const [workshopId, setWorkshopId] = useState("");
  const [stageId, setStageId] = useState("");
  const [sentAt, setSentAt] = useState(todayInputValue());
  const [parts, setParts] = useState("");
  const [reference, setReference] = useState("");
  const [rows, setRows] = useState<SizeBundleRow[]>(() => [emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);

  const captured = usableRows(rows).filter((row) => row.quantity > 0);
  const total = sumBundlePieces(captured);
  const bundles = sumBundles(captured);
  const counts = sizeCounts(props);

  function hintFor(sizeId: string) {
    const bits = [`${counts.cut(sizeId)} cortadas`];
    const alreadySent = stageId ? counts.sent(sizeId, stageId) : 0;
    if (alreadySent > 0) bits.push(`ya van ${alreadySent}`);
    const sending = sumBundlePieces(captured.filter((row) => row.value === sizeId));
    if (sending > 0) bits.push(`ahora ${sending}`);
    return bits.join(" · ");
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setRows([emptyRow()]);
      setParts("");
      setReference("");
      setResult(null);
    }
    setOpen(next);
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

    setSaving(true);
    try {
      const workshop = workshops.find((entry) => entry.id === workshopId)?.name ?? "Taller";
      const { outcome, localCode } = await captureOfflineShipment(
        {
          orderId: order.id,
          workshopId,
          stageId,
          sentAt,
          parts: parts.trim() || undefined,
          reference: reference.trim() || undefined,
          lines: captured.map((row) => ({
            sizeId: row.value,
            sentQuantity: row.quantity,
            bundles: row.bundles,
            tagId: row.tagId,
            notes: row.note,
          })),
        },
        `${order.code} → ${workshop} · ${total} piezas`,
      );
      const next = toCaptureResult(outcome, localCode);
      if ("error" in next) toast.error(next.error);
      else setResult(next.result);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Mandar a taller · ${order.code}`}
      description="Prendas ya cortadas que salen a un proceso. No mueve tela."
      trigger={
        <Button type="button" variant="outline" className="touch-target">
          <Send className="size-4" aria-hidden />
          Mandar a taller
        </Button>
      }
    >
      {/* Las etapas entraron a la copia después: un equipo que no ha vuelto a
          sincronizar no las tiene, y sin etapa el envío no se puede guardar. */}
      {stages.length === 0 && !result && (
        <p className="border border-border bg-muted p-2 text-sm">
          Este equipo no tiene las etapas en su copia. Con señal, vuelve a bajar
          la copia desde Datos sin conexión.
        </p>
      )}
      {result ? (
        <OfflineCaptureResult result={result} sentLabel="Envío registrado" onClose={() => handleOpenChange(false)} />
      ) : (
        <div className="flex flex-col gap-4">
          <FormSelectField id="offline-shipment-workshop" label="Taller">
            <SearchSelect
              id="offline-shipment-workshop"
              options={workshops.map((w) => ({ value: w.id, label: w.name }))}
              value={workshopId}
              onChange={setWorkshopId}
              placeholder="Elige el taller"
              searchPlaceholder="Buscar taller…"
            />
          </FormSelectField>

          <FormSelectField id="offline-shipment-stage" label="Etapa" hint="Para qué va: bordado, armado, lavado.">
            <SearchSelect
              id="offline-shipment-stage"
              options={stages.map((s) => ({ value: s.id, label: s.name }))}
              value={stageId}
              onChange={setStageId}
              placeholder="Elige la etapa"
              searchPlaceholder="Buscar etapa…"
            />
          </FormSelectField>

          <div className="flex flex-col gap-2">
            <Label htmlFor="offline-shipment-parts">Qué partes van</Label>
            <Input
              id="offline-shipment-parts"
              placeholder="Tapas y delantero izquierdo"
              value={parts}
              onChange={(event) => setParts(event.target.value)}
              className="touch-target"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="offline-shipment-date">Fecha de salida</Label>
              <Input
                id="offline-shipment-date"
                type="date"
                value={sentAt}
                onChange={(event) => setSentAt(event.target.value)}
                className="touch-target"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="offline-shipment-reference">Referencia</Label>
              <Input
                id="offline-shipment-reference"
                placeholder="Su folio"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="touch-target"
              />
            </div>
          </div>

          <SizeBundleRows
            tags={[...tags.values()].sort((a, b) => a.order - b.order)}
            editableNotes
            label="Bultos que van"
            options={toSizeOptions(order, sizes)}
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
            isSubmitting={saving}
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

/**
 * Lo cortado y lo enviado de cada talla: la copia MÁS lo que este celular
 * capturó y no ha subido, para que el contador no se quede atrás.
 */
function sizeCounts({ order, pendingCut, pendingSent }: Props) {
  function cut(sizeId: string): number {
    return order.lines
      .filter((line) => line.sizeId === sizeId)
      .reduce((sum, line) => sum + line.cutQuantity + (pendingCut.get(line.id) ?? 0), 0);
  }

  function sent(sizeId: string, stageId: string): number {
    const downloaded = order.sent
      .filter((count) => count.sizeId === sizeId && count.stageId === stageId)
      .reduce((sum, count) => sum + count.pieces, 0);
    return downloaded + (pendingSent.get(sizeStageKey(sizeId, stageId)) ?? 0);
  }

  return { cut, sent };
}

/**
 * Una opción por TALLA de la orden (el envío va por talla, no por renglón).
 * La anotación y el folio salen del primer renglón de esa talla, igual que
 * en línea, para que viajen al vale sin volver a teclearlos.
 */
function toSizeOptions(order: OfflineOrder, sizes: Map<string, OfflineSize>) {
  const seen = new Map<string, { note: string | null; tagId: string | null }>();
  for (const line of [...order.lines].sort((a, b) => a.position - b.position)) {
    if (!seen.has(line.sizeId)) seen.set(line.sizeId, { note: line.notes, tagId: line.tagId });
  }

  return [...seen.entries()].map(([sizeId, extra]) => {
    const size = sizes.get(sizeId);
    return {
      value: sizeId,
      code: size?.code ?? "—",
      hint: size?.name,
      keywords: size?.name,
      note: extra.note,
      defaultTagId: extra.tagId,
    };
  });
}
