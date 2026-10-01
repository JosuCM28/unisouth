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
  type Allocation,
  type AllocationTarget,
} from "@/lib/folder-cut-allocation";
import { cutBatchLabel } from "@/lib/constants/labels";
import { cutProgress, formatDate } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
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

/** Un corte de un corte global, tal como lo tiene una orden. */
export interface FolderCutBatch {
  id: string;
  groupId: string;
  label: string | null;
  openedAt: Date;
  /** Lo capturado, bulto por bulto. `quantity` es por bulto. */
  entries: {
    lineId: string;
    quantity: number;
    bundles: number;
    tagId: string | null;
  }[];
  /** El vale vivo de este corte. Con uno, ya no se puede cambiar. */
  issue: { code: string; isDraft: boolean } | null;
}

/** Una orden viva del pedido y sus renglones, tal como se ofrece aquí. */
export interface FolderCutOrder {
  id: string;
  code: string;
  /** Lo que la distingue de las demás del pedido: prenda o referencia. */
  hint: string | null;
  sizes: BatchSizeOption[];
  batches: FolderCutBatch[];
}

/** Un renglón de la captura física de un corte global, antes de repartirse. */
export interface CapturedCutRow {
  sizeCode: string;
  quantity: number;
  bundles: number;
  tagId: string | null;
}

interface Props {
  folderId: string;
  folderCode: string;
  orders: FolderCutOrder[];
  tags: CutTagChoice[];
  /**
   * Los bultos reales de cada corte global, por `groupId`. Un corte capturado
   * antes de guardarlos no aparece aquí y se reabre con sus pedazos por orden.
   */
  captures: Record<string, CapturedCutRow[]>;
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

/** Un corte global: los cortes de varias órdenes capturados como uno. */
interface CutGroup {
  id: string;
  label: string | null;
  openedAt: Date;
  /** Su corte en cada orden que lo recibió. */
  byOrder: Map<string, FolderCutBatch>;
  issue: { code: string; isDraft: boolean } | null;
}

/** Valor del selector que significa "ábreme un corte nuevo". */
const NEW_CUT = "__new__";

/**
 * Captura un corte que sirvió a varias órdenes del pedido a la vez.
 *
 * Es la MISMA pantalla que "Capturar corte" de una orden —selector de corte,
 * foleo de la tanda, bultos por talla, notas—, con una diferencia: las tallas
 * se anotan UNA vez, sumando todas las órdenes, y el sistema las reparte hasta
 * completar a cada una. Si dos piden talla S —50 y 100— se captura la S y
 * salen 150.
 *
 * Elegir un corte ya capturado lo abre para corregirlo: guardar lo REEMPLAZA y
 * se vuelve a repartir, igual que al corregir el corte de una orden.
 */
export function FolderCutDialog({
  folderId,
  folderCode,
  orders,
  tags,
  captures,
}: Props) {
  const router = useRouter();
  const totals = sizeTotals(orders);
  const groups = cutGroups(orders);

  const [open, setOpen] = useState(false);
  /* Arranca en el último corte, como la captura de una orden: lo normal es
     seguir en el que se trabaja. */
  const [groupId, setGroupId] = useState(groups[0]?.id ?? NEW_CUT);
  const [newLabel, setNewLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [batchTagId, setBatchTagId] = useState("");
  const [rows, setRows] = useState<SizeBundleRow[]>(() =>
    rowsOf(groups[0], orders, totals, captures),
  );
  const [isSaving, setIsSaving] = useState(false);

  const isNew = groupId === NEW_CUT;
  const selected = groups.find((group) => group.id === groupId);
  const blocked = selected?.issue ?? null;
  const isEditing = Boolean(selected);

  const captured = usableRows(rows).filter((row) => row.quantity > 0);
  const result = allocateBySize(
    allocationTargets(orders, selected),
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

  /* Lo que este corte ya aporta a una talla. Guardar REEMPLAZA, así que el
     acumulado es lo que dieron los OTROS cortes más lo que quede aquí. */
  function alreadyHere(code: string) {
    return sumBundlePieces(entriesOf(selected, orders, code));
  }

  function hintFor(code: string) {
    const total = byCode.get(code);
    if (!total) return null;

    const typed = sumBundlePieces(captured.filter((row) => row.value === code));
    const where = `${total.orders} ${total.orders === 1 ? "orden" : "órdenes"}`;

    if (typed !== 0) {
      const others = total.cut - alreadyHere(code);
      return `${total.cut} de ${total.ordered} en ${where} · quedaría en ${others + typed}`;
    }

    const { pending, surplus } = cutProgress(total.ordered, total.cut);
    const rest = surplus > 0 ? `sobran ${surplus}` : `faltan ${pending}`;

    return `${total.cut} de ${total.ordered} en ${where} · ${rest}`;
  }

  function applyTagToAll(next: string) {
    setBatchTagId(next);
    setRows((current) => current.map((row) => ({ ...row, tagId: next })));
  }

  function handleGroupChange(next: string) {
    setGroupId(next);
    setRows(rowsOf(
        groups.find((group) => group.id === next),
        orders,
        totals,
        captures,
      ),);
    setBatchTagId("");
  }

  function reset() {
    const first = groups[0];
    setGroupId(first?.id ?? NEW_CUT);
    setNewLabel("");
    setNotes("");
    setBatchTagId("");
    setRows(rowsOf(first, orders, totals, captures));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSave() {
    if (captured.length === 0) {
      toast.error("Agrega al menos un bulto con su talla y su cantidad.");
      return;
    }

    setIsSaving(true);
    const response = await runAction(() =>
      saveFolderCutAction({
        folderId,
        groupId: selected?.id,
        label: isNew ? newLabel || undefined : undefined,
        notes: notes || undefined,
        captured: captured.map((row) => ({
          sizeCode: row.value,
          quantity: row.quantity,
          bundles: row.bundles,
          tagId: row.tagId,
        })),
        orders: ordersPayload(orders, selected, result.allocations),
      }),
    );
    setIsSaving(false);

    if (!response.success) {
      toast.error(response.error);
      return;
    }

    toast.success(
      response.data.replaced
        ? `Corte corregido: ${response.data.pieces} piezas repartidas`
        : `${response.data.pieces} piezas repartidas en ${response.data.orders} ${
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
      title="Capturar corte global"
      description={
        isEditing
          ? "Este corte ya tiene bultos capturados. Corrígelos y se vuelven a repartir entre las órdenes."
          : `Varias órdenes de ${folderCode} cortadas juntas. Anota los bultos por talla, sumando todas; el sistema los reparte.`
      }
      trigger={
        <Button className="touch-target">
          <Scissors className="size-4" aria-hidden />
          Corte global
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="folder-cut">Corte</Label>
          <SearchSelect
            id="folder-cut"
            options={[
              ...groups.map((group, index) => ({
                value: group.id,
                label: group.label ?? cutBatchLabel(groups.length - index),
                hint: groupHint(group, orders),
              })),
              { value: NEW_CUT, label: "Corte nuevo" },
            ]}
            value={groupId}
            onChange={handleGroupChange}
            placeholder="Elige el corte"
            searchPlaceholder="Buscar corte…"
          />

          {blocked && (
            <p className="flex items-start gap-2 border border-state-reserved bg-card p-3 text-sm">
              <AlertTriangle
                className="size-4 shrink-0 text-state-reserved"
                aria-hidden
              />
              <span>
                Este corte ya salió en{" "}
                <span className="tabular font-medium">{blocked.code}</span> (
                {blocked.isDraft ? "borrador" : "aplicada"}) y no se puede
                cambiar: ese vale lleva su desglose bulto por bulto. Cancela la
                salida si necesitas corregirlo.
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="folder-cut-tag">Foleo de este corte</Label>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SearchSelect
                id="folder-cut-tag"
                options={tags.map((tag) => ({
                  value: tag.id,
                  label: tag.name,
                }))}
                value={batchTagId}
                onChange={applyTagToAll}
                placeholder="Sin foleo"
                searchPlaceholder="Buscar color…"
                clearLabel="Sin foleo"
              />
            </div>
            {tags.find((tag) => tag.id === batchTagId) && (
              <span
                className="size-9 shrink-0 border border-border"
                style={{
                  backgroundColor: tags.find((tag) => tag.id === batchTagId)
                    ?.color,
                }}
                aria-hidden
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Se pone en todas las tallas de abajo. Cámbialo renglón por renglón
            si de este corte salieron bultos de más de un color.
          </p>
        </div>

        {isNew && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-cut-label">Nombre del corte</Label>
            <Input
              id="folder-cut-label"
              placeholder="Opcional · quedará como «Corte conjunto»"
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              className="touch-target"
            />
          </div>
        )}

        <SizeBundleRows
          tags={tags}
          label="Bultos de este corte"
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
          footnote={
            isEditing
              ? "El corte queda EXACTAMENTE con estos renglones: lo que quites —o dejes en 0— desaparece de él y se vuelve a repartir. La misma talla se puede repetir."
              : "Las tallas en 0 no se guardan: teclea sólo las que salieron. Un bulto que no cabe entero en lo que falta a una orden se parte entre ésta y la siguiente."
          }
        />

        {/* Lo que va a pasar, ANTES de guardar: el reparto es automático y
            quien captura tiene que poder verlo y corregir el número. */}
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
                Con esta captura se rebasa lo pedido. Revisa que la cantidad
                sea la de CADA bulto y no el total de la talla.
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
          disabled={captured.length === 0 || Boolean(blocked)}
          className="h-12 w-full"
        >
          {isEditing ? "Guardar cambios" : "Guardar corte"}
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

/** Los cortes globales del pedido, el más reciente primero. */
function cutGroups(orders: FolderCutOrder[]): CutGroup[] {
  const byId = new Map<string, CutGroup>();

  for (const order of orders) {
    for (const batch of order.batches) {
      const group = byId.get(batch.groupId) ?? {
        id: batch.groupId,
        label: batch.label,
        openedAt: batch.openedAt,
        byOrder: new Map(),
        issue: null,
      };

      group.byOrder.set(order.id, batch);
      group.issue ??= batch.issue;
      byId.set(batch.groupId, group);
    }
  }

  return [...byId.values()].sort(
    (a, b) => b.openedAt.getTime() - a.openedAt.getTime(),
  );
}

/** Los bultos del corte, con el código de talla de cada uno. */
function entriesOf(
  group: CutGroup | undefined,
  orders: FolderCutOrder[],
  code?: string,
) {
  if (!group) return [];

  return orders.flatMap((order) => {
    const batch = group.byOrder.get(order.id);
    if (!batch) return [];

    const codeOfLine = new Map(order.sizes.map((s) => [s.lineId, s.code]));

    return batch.entries
      .filter((entry) => !code || codeOfLine.get(entry.lineId) === code)
      .map((entry) => ({
        ...entry,
        code: codeOfLine.get(entry.lineId) ?? "",
      }));
  });
}

/** Cuándo se abrió el corte y qué lleva, para reconocerlo en el selector. */
function groupHint(group: CutGroup, orders: FolderCutOrder[]): string {
  const pieces = sumBundlePieces(entriesOf(group, orders));
  return `${formatDate(group.openedAt)} · ${pieces} ${pieces === 1 ? "pza" : "pzas"} · ${group.byOrder.size} órdenes`;
}

/**
 * Los renglones con los que abre la pantalla para un corte.
 *
 * Igual que en la captura de una orden: todas las tallas en 0, y si el corte
 * ya tiene bultos vuelven con SUS números en vez del 0, porque la pantalla es
 * también la de corregir.
 */
function rowsOf(
  group: CutGroup | undefined,
  orders: FolderCutOrder[],
  totals: SizeTotal[],
  captures: Record<string, CapturedCutRow[]>,
): SizeBundleRow[] {
  /* Con la captura física guardada se reabre con ELLA: los pedazos por orden
     son el reparto, no lo que se tecleó, y volver a guardarlos convertiría un
     bulto de 28 en uno de 24 y otro de 4. */
  const physical = group ? captures[group.id] : undefined;
  const entries =
    physical && physical.length > 0
      ? physical.map((row) => ({ ...row, code: row.sizeCode }))
      : entriesOf(group, orders);

  const rows = totals.flatMap((total) => {
    const here = entries.filter((entry) => entry.code === total.code);

    if (here.length === 0) {
      return [
        {
          ...emptyRow(total.defaultTagId ?? ""),
          value: total.code,
          quantity: "0",
        },
      ];
    }

    return here.map((entry) => ({
      key: crypto.randomUUID(),
      value: total.code,
      quantity: String(entry.quantity),
      bundles: String(entry.bundles),
      tagId: entry.tagId ?? "",
      note: "",
    }));
  });

  return rows.length > 0 ? rows : [emptyRow()];
}

/**
 * Los renglones de todas las órdenes, con lo que a cada uno le falta.
 *
 * Al corregir un corte se le descuenta lo que ÉL ya dio: si no, el reparto
 * creería que esas piezas siguen contando y dejaría a las órdenes pidiendo
 * menos de lo que de verdad necesitan.
 */
function allocationTargets(
  orders: FolderCutOrder[],
  group: CutGroup | undefined,
): AllocationTarget[] {
  return orders.flatMap((order) => {
    const batch = group?.byOrder.get(order.id);

    return order.sizes.map((size) => {
      const here = sumBundlePieces(
        (batch?.entries ?? []).filter((entry) => entry.lineId === size.lineId),
      );

      return {
        orderId: order.id,
        orderCode: order.code,
        lineId: size.lineId,
        sizeKey: size.code,
        pending: Math.max(0, size.ordered - (size.cut - here)),
      };
    });
  });
}

/**
 * Lo repartido, por orden, en la forma que espera la acción.
 *
 * Al corregir, una orden que ya tenía su corte en el grupo viaja SIEMPRE —aun
 * sin piezas— para que su corte quede vacío en vez de conservar lo de antes.
 */
function ordersPayload(
  orders: FolderCutOrder[],
  group: CutGroup | undefined,
  allocations: Allocation[],
) {
  return orders.flatMap((order) => {
    const lines = allocations
      .filter((item) => item.orderId === order.id)
      .map((item) => ({
        lineId: item.lineId,
        quantity: item.quantity,
        bundles: item.bundles,
        tagId: item.tagId,
      }));

    const batchId = group?.byOrder.get(order.id)?.id;

    if (lines.length === 0 && !batchId) return [];

    return [{ orderId: order.id, batchId, lines }];
  });
}
