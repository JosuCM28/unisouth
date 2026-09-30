"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Scissors } from "lucide-react";
import { toast } from "sonner";
import { saveFolderCutAction } from "@/app/actions/order-folder.actions";
import { runAction } from "@/lib/offline/run-action";
import { sumBundlePieces, sumBundles } from "@/lib/bundles";
import {
  allocateBySize,
  type AllocationTarget,
} from "@/lib/folder-cut-allocation";
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

/** Lo que el pedido lleva de una talla, sumando todas sus órdenes. */
interface SizeTotal {
  code: string;
  name: string;
  ordered: number;
  cut: number;
  orders: number;
  defaultTagId: string | null;
}

/**
 * Captura un corte que sirvió a varias órdenes del pedido a la vez.
 *
 * Se anota UNA vez por talla, sumando todas las órdenes: si dos piden talla S
 * —50 y 100— se capturan los bultos de la S y el sistema los reparte entre las
 * dos hasta completar a cada una. Es como se corta de verdad: los bultos se
 * amarran pensando en el conjunto y nadie sabe de qué orden es cada uno hasta
 * que se reparten.
 *
 * Abre un corte NUEVO en cada orden que reciba piezas; para sumarle a un corte
 * que ya existe se usa "Capturar corte" dentro de la orden.
 */
export function FolderCutDialog({ folderId, folderCode, orders, tags }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const totals = sizeTotals(orders);
  const [rows, setRows] = useState<SizeBundleRow[]>(() => initialRows(totals));

  const targets = allocationTargets(orders);
  const captured = usableRows(rows).filter((row) => row.quantity > 0);

  const result = allocateBySize(
    targets,
    captured.map((row) => ({
      sizeKey: row.value,
      quantity: row.quantity,
      bundles: row.bundles,
      tagId: row.tagId,
    })),
  );

  const pieces = sumBundlePieces(captured);
  const bundles = sumBundles(captured);
  const byCode = new Map(totals.map((total) => [total.code, total]));

  function hintFor(code: string) {
    const total = byCode.get(code);
    if (!total) return null;

    const typed = sumBundlePieces(captured.filter((row) => row.value === code));
    const where = `${total.orders} ${total.orders === 1 ? "orden" : "órdenes"}`;

    if (typed !== 0) {
      return `${total.cut} de ${total.ordered} en ${where} · quedaría en ${total.cut + typed}`;
    }

    const { pending, surplus } = cutProgress(total.ordered, total.cut);
    const rest = surplus > 0 ? `sobran ${surplus}` : `faltan ${pending}`;

    return `${total.cut} de ${total.ordered} en ${where} · ${rest}`;
  }

  function reset() {
    setLabel("");
    setNotes("");
    setRows(initialRows(totals));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSave() {
    if (result.allocations.length === 0) {
      toast.error("Anota al menos un bulto de alguna talla.");
      return;
    }

    setIsSaving(true);
    const response = await runAction(() =>
      saveFolderCutAction({
        folderId,
        label: label || undefined,
        notes: notes || undefined,
        orders: ordersOf(result.allocations),
      }),
    );
    setIsSaving(false);

    if (!response.success) {
      toast.error(response.error);
      return;
    }

    toast.success(
      `Corte global: ${response.data.pieces} piezas repartidas en ${response.data.orders} ${
        response.data.orders === 1 ? "orden" : "órdenes"
      }`,
    );
    setOpen(false);
    reset();
    router.refresh();
  }

  const perOrder = orders
    .map((order) => ({
      order,
      items: result.allocations.filter((item) => item.orderId === order.id),
    }))
    .filter((entry) => entry.items.length > 0);

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Corte global de ${folderCode}`}
      description="Anota los bultos por talla, sumando todas las órdenes. El sistema los reparte hasta completar a cada una."
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

        <SizeBundleRows
          tags={tags}
          label="Bultos del corte"
          options={totals.map((total) => ({
            value: total.code,
            code: total.code,
            hint: total.name,
            keywords: total.name,
            note: null,
            tag: null,
          }))}
          rows={rows}
          onChange={setRows}
          renderHint={hintFor}
          footnote="Las tallas en 0 no se guardan. Un bulto que no cabe entero en lo que falta a una orden se parte entre ésta y la siguiente."
        />

        {/* Lo que va a pasar, ANTES de guardar: el reparto es automático y
            quien captura tiene que poder verlo y corregir el número si no es
            el que esperaba. */}
        {perOrder.length > 0 && (
          <div className="flat-surface flex flex-col gap-3 p-3">
            <h3 className="text-sm font-semibold">Así se reparte</h3>
            {perOrder.map(({ order, items }) => (
              <div key={order.id}>
                <p className="tabular text-sm font-medium">
                  {order.code}
                  {order.hint && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {order.hint}
                    </span>
                  )}
                </p>
                <ul className="tabular text-xs text-muted-foreground">
                  {items.map((item) => (
                    <li key={`${item.lineId}-${item.quantity}-${item.tagId}`}>
                      Talla {item.sizeKey}: {item.bundles}{" "}
                      {item.bundles === 1 ? "bulto" : "bultos"} de{" "}
                      {item.quantity} = {item.bundles * item.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {result.surplus.length > 0 && (
          <div className="flex items-start gap-2 border border-state-reserved bg-card p-3 text-sm">
            <AlertTriangle
              className="size-4 shrink-0 text-state-reserved"
              aria-hidden
            />
            <div className="flex flex-col gap-1">
              <span>
                Con esto se rebasa lo pedido. Revisa que la cantidad sea la de
                CADA bulto y no el total de la talla.
              </span>
              <ul className="tabular flex flex-col">
                {result.surplus.map((row) => (
                  <li key={row.sizeKey}>
                    Talla {row.sizeKey}: sobran {row.pieces} después de
                    completar todas las órdenes
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

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
            {perOrder.length} {perOrder.length === 1 ? "orden" : "órdenes"}
          </p>
        )}

        <SubmitButton
          isSubmitting={isSaving}
          onClick={handleSave}
          disabled={result.allocations.length === 0}
          className="h-12 w-full"
        >
          Guardar corte global
        </SubmitButton>
      </div>
    </ResponsiveFormDialog>
  );
}

/** Una talla por código, con lo pedido y cortado de todas las órdenes. */
function sizeTotals(orders: FolderCutOrder[]): SizeTotal[] {
  const byCode = new Map<string, SizeTotal>();

  for (const order of orders) {
    for (const size of order.sizes) {
      const current = byCode.get(size.code) ?? {
        code: size.code,
        name: size.name,
        ordered: 0,
        cut: 0,
        orders: 0,
        defaultTagId: size.tagId,
      };

      current.ordered += size.ordered;
      current.cut += size.cut;
      current.orders += 1;
      current.defaultTagId ??= size.tagId;
      byCode.set(size.code, current);
    }
  }

  return [...byCode.values()];
}

/** Los renglones de todas las órdenes, con lo que a cada uno le falta. */
function allocationTargets(orders: FolderCutOrder[]): AllocationTarget[] {
  return orders.flatMap((order) =>
    order.sizes.map((size) => ({
      orderId: order.id,
      orderCode: order.code,
      lineId: size.lineId,
      sizeKey: size.code,
      pending: Math.max(0, size.ordered - size.cut),
    })),
  );
}

/** Lo repartido, agrupado por orden en la forma que espera la acción. */
function ordersOf(
  allocations: ReturnType<typeof allocateBySize>["allocations"],
) {
  const byOrder = new Map<
    string,
    { lineId: string; quantity: number; bundles: number; tagId?: string }[]
  >();

  for (const item of allocations) {
    byOrder.set(item.orderId, [
      ...(byOrder.get(item.orderId) ?? []),
      {
        lineId: item.lineId,
        quantity: item.quantity,
        bundles: item.bundles,
        tagId: item.tagId,
      },
    ]);
  }

  return [...byOrder].map(([orderId, lines]) => ({ orderId, lines }));
}

/**
 * Todas las tallas del pedido en 0, con el foleo que alguna orden sugiere. El
 * 0 no se guarda; dejar la lista completa hace que se vea qué falta capturar.
 */
function initialRows(totals: SizeTotal[]): SizeBundleRow[] {
  if (totals.length === 0) return [emptyRow()];

  return totals.map((total) => ({
    ...emptyRow(total.defaultTagId ?? ""),
    value: total.code,
    quantity: "0",
  }));
}
