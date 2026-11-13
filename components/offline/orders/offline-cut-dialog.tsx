"use client";

import { useState } from "react";
import { Scissors } from "lucide-react";
import { toast } from "sonner";
import { sumBundlePieces, sumBundles } from "@/lib/bundles";
import { captureOfflineCut } from "@/lib/offline/offline-order-captures";
import type { OfflineCutTag, OfflineOrder, OfflineSize } from "@/lib/offline/snapshot.types";
import { cutProgress } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  OfflineCaptureResult,
  toCaptureResult,
  type CaptureResult,
} from "./offline-capture-result";

interface Props {
  order: OfflineOrder;
  sizes: Map<string, OfflineSize>;
  tags: Map<string, OfflineCutTag>;
  /** Piezas de cortes que este celular capturó y no han subido, por renglón. */
  pendingCut: Map<string, number>;
}

/**
 * Captura un corte SIN internet: la misma tabla de bultos que en línea.
 *
 * Siempre es un corte nuevo —el número lo pone el servidor al subirlo—: sin
 * señal no se conocen los cortes de la orden, y corregir uno a ciegas
 * reemplazaría lo que alguien más capturó mientras tanto.
 */
export function OfflineCutDialog({ order, sizes, tags, pendingCut }: Props) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<SizeBundleRow[]>(() => [emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);

  const captured = usableRows(rows);
  const total = sumBundlePieces(captured);
  const bundles = sumBundles(captured);
  const lineById = new Map(order.lines.map((line) => [line.id, line]));

  /* Lo cortado incluye lo pendiente de este celular: sin eso la ficha diría
     "faltan 40" justo después de capturarlas, y se volverían a capturar. */
  function cutSoFar(lineId: string): number {
    return (lineById.get(lineId)?.cutQuantity ?? 0) + (pendingCut.get(lineId) ?? 0);
  }

  function hintFor(lineId: string) {
    const line = lineById.get(lineId);
    if (!line) return null;

    const cut = cutSoFar(lineId);
    const typed = sumBundlePieces(captured.filter((row) => row.value === lineId));
    if (typed !== 0) return `${cut} de ${line.orderedQuantity} · quedaría en ${cut + typed}`;

    const { pending, surplus } = cutProgress(line.orderedQuantity, cut);
    if (surplus > 0) return `${cut} de ${line.orderedQuantity} · ${surplus} de más`;
    return `${cut} de ${line.orderedQuantity} · faltan ${pending}`;
  }

  function reset() {
    setRows([emptyRow()]);
    setLabel("");
    setNotes("");
    setResult(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    setOpen(next);
  }

  async function handleSave() {
    if (captured.length === 0) {
      toast.error("Captura cuántas piezas salieron de al menos una talla.");
      return;
    }

    setSaving(true);
    try {
      const { outcome, localCode } = await captureOfflineCut(
        {
          orderId: order.id,
          newBatchLabel: label.trim() || undefined,
          notes: notes.trim() || undefined,
          lines: captured.map((row) => ({
            lineId: row.value,
            quantity: row.quantity,
            bundles: row.bundles,
            tagId: row.tagId,
          })),
        },
        `${order.code} · ${total} piezas en ${bundles} ${bundles === 1 ? "bulto" : "bultos"}`,
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
      title={`Capturar corte · ${order.code}`}
      description="Corte nuevo. Si no hay señal se guarda en el equipo y sube solo."
      trigger={
        <Button type="button" className="touch-target">
          <Scissors className="size-4" aria-hidden />
          Capturar corte
        </Button>
      }
    >
      {result ? (
        <OfflineCaptureResult result={result} sentLabel="Corte guardado" onClose={() => handleOpenChange(false)} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="offline-batch-label">Nombre del corte</Label>
            <Input
              id="offline-batch-label"
              placeholder="Opcional: muestra, segundo tendido…"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="touch-target"
            />
          </div>

          <SizeBundleRows
            tags={[...tags.values()].sort((a, b) => a.order - b.order)}
            label="Bultos de este corte"
            options={toLineOptions(order, sizes, tags)}
            rows={rows}
            onChange={setRows}
            renderHint={hintFor}
            footnote="Las tallas en 0 no se guardan. La misma talla se puede repetir: un bulto de 30 y otro de 20 son dos renglones."
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="offline-batch-notes">Notas del corte</Label>
            <Textarea
              id="offline-batch-notes"
              rows={2}
              placeholder="Quién cortó, en qué mesa…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

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
            Guardar corte
          </SubmitButton>
        </div>
      )}
    </ResponsiveFormDialog>
  );
}

/**
 * Un renglón de la orden por opción, no una talla: la misma talla puede venir
 * dos veces con anotaciones distintas, igual que en el corte en línea.
 */
function toLineOptions(
  order: OfflineOrder,
  sizes: Map<string, OfflineSize>,
  tags: Map<string, OfflineCutTag>,
) {
  return [...order.lines]
    .sort((a, b) => a.position - b.position)
    .map((line) => {
      const size = sizes.get(line.sizeId);
      const tag = line.tagId ? tags.get(line.tagId) : undefined;
      return {
        value: line.id,
        code: size?.code ?? "—",
        hint: line.notes ?? size?.name,
        keywords: size?.name,
        note: line.notes,
        tag: tag ? { name: tag.name, color: tag.color } : null,
        defaultTagId: line.tagId,
      };
    });
}
