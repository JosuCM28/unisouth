"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";
import { toast } from "sonner";
import { saveFolderCutAction } from "@/app/actions/order-folder.actions";
import { runAction } from "@/lib/offline/run-action";
import { sumBundlePieces, sumBundles } from "@/lib/bundles";
import { cutProgress } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import type { BatchSizeOption } from "@/components/orders/order-batch-dialog";
import {
  emptyRow,
  SizeBundleRows,
  usableRows,
  type CutTagChoice,
  type SizeBundleRow,
} from "@/components/orders/size-bundle-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Una orden viva del pedido y sus renglones, tal como se ofrece aquí. */
export interface FolderCutOrder {
  id: string;
  code: string;
  /** Lo que la distingue de las demás del pedido: prenda o referencia. */
  hint: string | null;
  sizes: BatchSizeOption[];
}

interface Props {
  folderId: string;
  folderCode: string;
  orders: FolderCutOrder[];
  tags: CutTagChoice[];
}

/**
 * Captura un corte que sirvió a varias órdenes del pedido a la vez.
 *
 * Existe porque a veces dos órdenes se tienden juntas y los bultos se amarran
 * pensando en ambas. Con la captura por orden había que abrir dos diálogos y
 * repartir a mano lo que salió de una sola mesa. Aquí se ve cada orden con sus
 * tallas y se anotan los bultos de cada una en el mismo paso.
 *
 * Siempre abre un corte NUEVO en cada orden que lleve piezas; para sumarle a
 * un corte que ya existe se usa "Capturar corte" dentro de la orden.
 */
export function FolderCutDialog({ folderId, folderCode, orders, tags }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [rowsByOrder, setRowsByOrder] = useState<
    Record<string, SizeBundleRow[]>
  >(() => initialRows(orders));
  const [isSaving, setIsSaving] = useState(false);

  /* Sólo las órdenes que llevan algo: una en blanco no se manda, y así el
     auxiliar puede dejar intacta la que no entró en este tendido. */
  const captured = orders
    .map((order) => ({
      order,
      rows: usableRows(rowsByOrder[order.id] ?? []),
    }))
    .filter((entry) => entry.rows.length > 0);

  const allRows = captured.flatMap((entry) => entry.rows);
  const pieces = sumBundlePieces(allRows);
  const bundles = sumBundles(allRows);

  function reset() {
    setLabel("");
    setNotes("");
    setRowsByOrder(initialRows(orders));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSave() {
    if (captured.length === 0) {
      toast.error("Anota al menos un bulto en alguna de las órdenes.");
      return;
    }

    setIsSaving(true);
    const result = await runAction(() =>
      saveFolderCutAction({
        folderId,
        label: label || undefined,
        notes: notes || undefined,
        orders: captured.map(({ order, rows }) => ({
          orderId: order.id,
          lines: rows.map((row) => ({
            lineId: row.value,
            quantity: row.quantity,
            bundles: row.bundles,
            tagId: row.tagId,
          })),
        })),
      }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Corte global: ${result.data.pieces} piezas en ${result.data.orders} ${
        result.data.orders === 1 ? "orden" : "órdenes"
      }`,
    );
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Corte global de ${folderCode}`}
      description="Para cuando varias órdenes se cortaron juntas. Anota los bultos de cada orden; se abre un corte nuevo en cada una."
      trigger={
        <Button className="touch-target">
          <Scissors className="size-4" aria-hidden />
          Corte global
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="folder-cut-label">Nombre del corte</Label>
          <Input
            id="folder-cut-label"
            placeholder="Opcional · por omisión «Corte conjunto»"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="touch-target"
          />
        </div>

        {orders.map((order) => (
          <OrderSection
            key={order.id}
            order={order}
            tags={tags}
            rows={rowsByOrder[order.id] ?? []}
            onChange={(rows) =>
              setRowsByOrder((current) => ({ ...current, [order.id]: rows }))
            }
          />
        ))}

        <div className="flex flex-col gap-2">
          <Label htmlFor="folder-cut-notes">Notas del corte</Label>
          <Textarea
            id="folder-cut-notes"
            rows={2}
            placeholder="Quién cortó, en qué mesa…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {captured.length > 0 && (
          <p className="tabular border border-border bg-muted p-2 text-sm">
            {pieces} piezas · {bundles} {bundles === 1 ? "bulto" : "bultos"} ·{" "}
            {captured.length} {captured.length === 1 ? "orden" : "órdenes"}
          </p>
        )}

        <SubmitButton
          isSubmitting={isSaving}
          onClick={handleSave}
          disabled={captured.length === 0}
          className="h-12 w-full"
        >
          Guardar corte global
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}

function OrderSection({
  order,
  tags,
  rows,
  onChange,
}: {
  order: FolderCutOrder;
  tags: CutTagChoice[];
  rows: SizeBundleRow[];
  onChange: (rows: SizeBundleRow[]) => void;
}) {
  const byLine = new Map(order.sizes.map((size) => [size.lineId, size]));

  /* Lo que lleva la talla y cuánto falta, con lo tecleado ya sumado: igual que
     en la captura de una orden, para que el bulto se reparta viendo cuánto
     necesita cada una. */
  function hintFor(lineId: string) {
    const size = byLine.get(lineId);
    if (!size) return null;

    const typed = sumBundlePieces(
      usableRows(rows).filter((row) => row.value === lineId),
    );

    if (typed !== 0) {
      return `${size.cut} de ${size.ordered} · quedaría en ${size.cut + typed}`;
    }

    const { pending, surplus } = cutProgress(size.ordered, size.cut);
    const rest = surplus > 0 ? `sobran ${surplus}` : `faltan ${pending}`;

    return `${size.cut} de ${size.ordered} · ${rest}`;
  }

  return (
    <section className="flat-surface flex flex-col gap-3 p-3">
      <div>
        <h3 className="tabular text-sm font-semibold">{order.code}</h3>
        {order.hint && (
          <p className="text-xs text-muted-foreground">{order.hint}</p>
        )}
      </div>

      <SizeBundleRows
        tags={tags}
        label="Bultos de esta orden"
        options={order.sizes.map((size) => ({
          value: size.lineId,
          code: size.code,
          hint: size.note ?? size.name,
          keywords: size.name,
          note: size.note,
          tag: size.tag,
        }))}
        rows={rows}
        onChange={onChange}
        renderHint={hintFor}
      />
    </section>
  );
}

/**
 * Todas las tallas de cada orden puestas en 0, con el foleo que la orden
 * sugiere. El 0 no se guarda, así que dejar la lista completa no mete tallas
 * vacías; lo que sí hace es que se vea qué falta capturar.
 */
function initialRows(orders: FolderCutOrder[]) {
  return Object.fromEntries(
    orders.map((order) => [
      order.id,
      order.sizes.length > 0
        ? order.sizes.map((size) => ({
            ...emptyRow(size.tagId ?? ""),
            value: size.lineId,
            quantity: "0",
          }))
        : [emptyRow()],
    ]),
  );
}
