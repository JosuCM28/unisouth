"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { savePackingListSheetAction } from "@/app/actions/packing-list-sheet.actions";
import { runAction } from "@/lib/offline/run-action";
import {
  draftPieces,
  emptyRow,
  findMismatches,
  refillRows,
  syncBoxes,
  toSheetInput,
  type DraftRow,
  type PackingListDraft,
} from "@/lib/packing/packing-list-draft";
import { formatQuantity } from "@/lib/utils";
import { packingListSheetSchema } from "@/lib/validations/packing-list-sheet.schema";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PackingListEditorBoxes } from "./packing-list-editor-boxes";
import { PackingListEditorHeader } from "./packing-list-editor-header";
import { PackingListEditorRows } from "./packing-list-editor-rows";
import { PackingListSaveBar } from "./packing-list-save-bar";

interface EditorProps {
  orderId: string;
  initial: PackingListDraft;
  /** Los renglones como salen hoy de las cajas, para volver a llenar. */
  fromBoxes: DraftRow[];
  /** Las piezas que de verdad hay en las cajas. */
  boxesPieces: number;
  /** Piezas por caja y talla (`boxSizeKey`), para señalar el renglón que no cuadra. */
  inBoxes: Record<string, number>;
  saved: boolean;
  canEdit: boolean;
}

function fromInitial(initial: PackingListDraft): PackingListDraft {
  return { ...initial, boxes: syncBoxes(initial.rows, initial.boxes) };
}

/**
 * El packing list editable. Se prellena con las cajas y aquí se corrige todo
 * lo que va al papel; lo que se exporta es lo GUARDADO, por eso las
 * descargas se esconden mientras haya cambios sin guardar.
 */
export function PackingListEditor({ orderId, initial, fromBoxes, boxesPieces, inBoxes, saved, canEdit }: EditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => fromInitial(initial));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function change(patch: Partial<PackingListDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      return patch.rows ? { ...next, boxes: syncBoxes(next.rows, next.boxes) } : next;
    });
    setDirty(true);
  }

  function discard() {
    setDraft(fromInitial(initial));
    setDirty(false);
  }

  async function handleSave() {
    const parsed = packingListSheetSchema.safeParse(toSheetInput(orderId, draft));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    setSaving(true);
    const result = await runAction(() => savePackingListSheetAction(parsed.data));
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Packing list guardado");
    setDirty(false);
    router.refresh();
  }

  const readOnly = !canEdit;
  const pieces = draftPieces(draft.rows);
  const mismatches = useMemo(() => findMismatches(draft.rows, inBoxes), [draft.rows, inBoxes]);

  return (
    <div className="flex flex-col gap-4">
      <UnsavedChangesGuard when={dirty && canEdit} title="¿Salir sin guardar el packing list?"
        description="Tienes cambios en el packing list que todavía no guardas." />

      <PackingListEditorHeader draft={draft} onChange={change} readOnly={readOnly} />
      <MismatchNotice pieces={pieces} boxesPieces={boxesPieces} rows={mismatches.size} />

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Renglones</h2>
            <p className="tabular text-xs text-muted-foreground">
              {draft.rows.length} {draft.rows.length === 1 ? "renglón" : "renglones"} · {formatQuantity(pieces)} pzas
            </p>
          </div>
          {!readOnly && (
            <RowsToolbar
              onDestination={(destination) => change({ rows: draft.rows.map((row) => ({ ...row, destination })) })}
              onRefill={() => change({ rows: refillRows(draft.rows, fromBoxes) })}
              onAdd={() => change({ rows: [...draft.rows, emptyRow(draft.rows.at(-1)?.boxNumber ?? "")] })}
            />
          )}
        </div>
        <PackingListEditorRows rows={draft.rows} onChange={(rows) => change({ rows })} readOnly={readOnly}
          mismatches={mismatches} pieces={pieces} />
      </section>

      <PackingListEditorBoxes boxes={draft.boxes} onChange={(boxes) => change({ boxes })} readOnly={readOnly} />

      <PackingListSaveBar orderId={orderId} dirty={dirty} saved={saved} saving={saving} canEdit={canEdit}
        onSave={handleSave} onDiscard={discard} />
    </div>
  );
}

/**
 * Las tres herramientas de los renglones en una sola barra. "Destino para
 * todos" se teclea y se aplica aquí mismo, junto a lo que afecta: antes
 * vivía suelto arriba de la tabla y parecía un campo del encabezado.
 */
function RowsToolbar({
  onDestination,
  onRefill,
  onAdd,
}: {
  onDestination: (destination: string) => void;
  onRefill: () => void;
  onAdd: () => void;
}) {
  const [destination, setDestination] = useState("");

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex">
        <Input aria-label="Destino para todos los renglones" value={destination} placeholder="Destino para todos"
          onChange={(event) => setDestination(event.target.value)}
          className="touch-target min-w-0 flex-1 border-r-0 uppercase placeholder:normal-case sm:w-48" />
        <Button type="button" variant="outline" className="touch-target" disabled={!destination.trim()}
          onClick={() => onDestination(destination.trim().toUpperCase())}>
          Aplicar
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <RefillButton onConfirm={onRefill} />
        <Button type="button" variant="outline" className="touch-target" onClick={onAdd}>
          <Plus className="size-4" aria-hidden />
          Renglón
        </Button>
      </div>
    </div>
  );
}

/**
 * No bloquea: la hoja es de quien la escribe. Pero tiene que quedar claro
 * que cambiar una cantidad aquí NO mete ni saca prenda: eso se hace en la
 * caja, que es la que mueve el inventario.
 */
function MismatchNotice({ pieces, boxesPieces, rows }: { pieces: number; boxesPieces: number; rows: number }) {
  if (pieces === boxesPieces && rows === 0) return null;
  return (
    <div role="status" className="flex gap-3 border border-state-reserved bg-state-reserved-muted p-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-medium">
          El packing list dice <span className="tabular">{formatQuantity(pieces)}</span> pzas y las cajas
          llevan <span className="tabular">{formatQuantity(boxesPieces)}</span>
          {rows > 0 && <> · {rows} {rows === 1 ? "renglón no cuadra" : "renglones no cuadran"}</>}.
        </p>
        <p className="text-muted-foreground">
          Esta hoja es sólo el papel: cambiar una cantidad aquí no descuenta ni regresa inventario. Para
          meter o sacar prenda, entra a la caja; luego usa “Volver a llenar desde las cajas”.
        </p>
      </div>
    </div>
  );
}

function RefillButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <ConfirmDialog
      title="¿Volver a llenar los renglones?"
      description="Los renglones se rehacen con lo que hay hoy en las cajas. Se conserva la orden, el destino, la descripción y el color que ya escribiste en cada prenda; los renglones agregados a mano se quitan."
      confirmLabel="Volver a llenar"
      onConfirm={onConfirm}
      trigger={
        <Button type="button" variant="outline" className="touch-target">
          <RefreshCw className="size-4" aria-hidden />
          Volver a llenar desde las cajas
        </Button>
      }
    />
  );
}
