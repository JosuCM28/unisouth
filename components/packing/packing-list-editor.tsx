"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { savePackingListSheetAction } from "@/app/actions/packing-list-sheet.actions";
import { runAction } from "@/lib/offline/run-action";
import {
  draftPieces,
  emptyRow,
  refillRows,
  syncBoxes,
  toSheetInput,
  type DraftRow,
  type PackingListDraft,
} from "@/lib/packing/packing-list-draft";
import { formatQuantity } from "@/lib/utils";
import { packingListSheetSchema } from "@/lib/validations/packing-list-sheet.schema";
import { ExportButton } from "@/components/shared/export-button";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PackingListEditorBoxes } from "./packing-list-editor-boxes";
import { PackingListEditorRows } from "./packing-list-editor-rows";

interface EditorProps {
  orderId: string;
  initial: PackingListDraft;
  /** Los renglones como salen hoy de las cajas, para volver a llenar. */
  fromBoxes: DraftRow[];
  /** Las piezas que de verdad hay en las cajas. */
  boxesPieces: number;
  saved: boolean;
  canEdit: boolean;
}

/**
 * El packing list editable. Se prellena con las cajas y aquí se corrige todo
 * lo que va al papel; lo que se exporta es lo GUARDADO, por eso las
 * descargas se esconden mientras haya cambios sin guardar.
 */
export function PackingListEditor({ orderId, initial, fromBoxes, boxesPieces, saved, canEdit }: EditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => ({ ...initial, boxes: syncBoxes(initial.rows, initial.boxes) }));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [destination, setDestination] = useState("");

  function change(patch: Partial<PackingListDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      return patch.rows ? { ...next, boxes: syncBoxes(next.rows, next.boxes) } : next;
    });
    setDirty(true);
  }

  function applyDestination() {
    change({ rows: draft.rows.map((row) => ({ ...row, destination })) });
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

  return (
    <div className="flex flex-col gap-4">
      <HeaderFields draft={draft} onChange={change} readOnly={readOnly} />
      <MismatchNotice pieces={pieces} boxesPieces={boxesPieces} />

      {!readOnly && (
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pl-destination">Destino para todos</Label>
              <Input id="pl-destination" value={destination} placeholder="VERACRUZ"
                onChange={(event) => setDestination(event.target.value)} className="touch-target uppercase" />
            </div>
            <Button type="button" variant="outline" className="touch-target" onClick={applyDestination}>
              Aplicar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <RefillButton onConfirm={() => change({ rows: refillRows(draft.rows, fromBoxes) })} />
            <Button type="button" variant="outline" className="touch-target"
              onClick={() => change({ rows: [...draft.rows, emptyRow(draft.rows.at(-1)?.boxNumber ?? "")] })}>
              <Plus className="size-4" aria-hidden />
              Renglón
            </Button>
          </div>
        </div>
      )}

      <PackingListEditorRows rows={draft.rows} onChange={(rows) => change({ rows })} readOnly={readOnly} />
      <p className="tabular text-right text-sm font-medium">Total: {formatQuantity(pieces)} pzas</p>
      <PackingListEditorBoxes boxes={draft.boxes} onChange={(boxes) => change({ boxes })} readOnly={readOnly} />

      <Footer orderId={orderId} dirty={dirty} saved={saved} saving={saving} canEdit={canEdit} onSave={handleSave} />
    </div>
  );
}

type HeaderField = "client" | "date" | "preparedBy" | "reviewedBy" | "receivedBy" | "formatCode" | "revision";

const HEADER_FIELDS: { field: HeaderField; label: string; type?: "date" }[] = [
  { field: "client", label: "Cliente" },
  { field: "date", label: "Fecha", type: "date" },
  { field: "preparedBy", label: "Elaboró" },
  { field: "reviewedBy", label: "Revisó" },
  { field: "receivedBy", label: "Recibió (transportista)" },
  { field: "formatCode", label: "Código del formato" },
  { field: "revision", label: "Revisión" },
];

function HeaderFields({
  draft,
  onChange,
  readOnly,
}: {
  draft: PackingListDraft;
  onChange: (patch: Partial<PackingListDraft>) => void;
  readOnly: boolean;
}) {
  return (
    <section className="flat-surface grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      {HEADER_FIELDS.map(({ field, label, type }) => (
        <div key={field} className="flex flex-col gap-2">
          <Label htmlFor={`pl-${field}`}>{label}</Label>
          <Input id={`pl-${field}`} type={type} value={draft[field]} readOnly={readOnly}
            onChange={(event) => onChange({ [field]: event.target.value })}
            className={type ? "touch-target" : "touch-target uppercase"} />
        </div>
      ))}
      <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
        <Label htmlFor="pl-notes">Notas</Label>
        <Textarea id="pl-notes" rows={2} value={draft.notes} readOnly={readOnly}
          onChange={(event) => onChange({ notes: event.target.value })} className="uppercase" />
      </div>
    </section>
  );
}

/** No bloquea: la hoja es de quien la escribe, pero tiene que saber que ya no cuadra. */
function MismatchNotice({ pieces, boxesPieces }: { pieces: number; boxesPieces: number }) {
  if (pieces === boxesPieces) return null;
  return (
    <p className="border border-border bg-muted p-3 text-sm">
      El packing list dice <span className="tabular font-medium">{formatQuantity(pieces)}</span> pzas y las cajas
      tienen <span className="tabular font-medium">{formatQuantity(boxesPieces)}</span>. Revisa los renglones o usa
      “Volver a llenar desde las cajas”.
    </p>
  );
}

function RefillButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="touch-target">
          <RefreshCw className="size-4" aria-hidden />
          Volver a llenar desde las cajas
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Volver a llenar los renglones?</AlertDialogTitle>
          <AlertDialogDescription>
            Los renglones se rehacen con lo que hay hoy en las cajas. Se conserva la orden, el destino, la
            descripción y el color que ya escribiste en cada prenda; los renglones agregados a mano se quitan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="touch-target">Cancelar</AlertDialogCancel>
          <AlertDialogAction className="touch-target" onClick={onConfirm}>Volver a llenar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Footer({
  orderId,
  dirty,
  saved,
  saving,
  canEdit,
  onSave,
}: {
  orderId: string;
  dirty: boolean;
  saved: boolean;
  saving: boolean;
  canEdit: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">{footerMessage(dirty, saved)}</p>
      <div className="flex flex-wrap gap-2">
        {!dirty && (
          <>
            <Button asChild variant="outline" className="touch-target">
              <a href={`/api/packing/${orderId}/pdf`} target="_blank" rel="noopener">
                <FileText className="size-4" aria-hidden />
                PDF
              </a>
            </Button>
            <ExportButton href={`/api/export/packing/${orderId}`} label="Excel" exact />
          </>
        )}
        {canEdit && (
          <SubmitButton isSubmitting={saving} onClick={onSave} disabled={!dirty} className="h-11">
            Guardar
          </SubmitButton>
        )}
      </div>
    </div>
  );
}

/** Lo que se descarga es lo guardado: con cambios pendientes, se dice. */
function footerMessage(dirty: boolean, saved: boolean): string {
  if (dirty) return "Tienes cambios sin guardar. Guarda para exportarlos.";
  if (saved) return "Se exporta la versión guardada.";
  return "Aún no se guarda: se exporta lo que dicen las cajas.";
}
