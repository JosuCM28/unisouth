"use client";

import { FileText, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportButton } from "@/components/shared/export-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";

interface SaveBarProps {
  orderId: string;
  dirty: boolean;
  saved: boolean;
  saving: boolean;
  canEdit: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

/**
 * El pie del packing list. En escritorio se queda pegado abajo: con veinte
 * renglones el botón de guardar quedaba a dos pantallas de distancia y se
 * salía sin verlo.
 *
 * Con cambios pendientes las descargas se esconden: lo que se exporta es lo
 * GUARDADO, y un PDF que no trae lo que se ve en pantalla confunde.
 */
export function PackingListSaveBar({ orderId, dirty, saved, saving, canEdit, onSave, onDiscard }: SaveBarProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-border bg-background py-3 sm:flex-row sm:items-center sm:justify-between md:sticky md:bottom-0 md:z-10">
      <p className="flex items-center gap-2 text-sm">
        <span aria-hidden className={cn("size-2 shrink-0", dirty ? "bg-state-reserved" : "bg-state-available")} />
        <span className={cn(!dirty && "text-muted-foreground")}>{statusMessage(dirty, saved)}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {dirty && canEdit && <DiscardButton disabled={saving} onConfirm={onDiscard} />}
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
          <SubmitButton isSubmitting={saving} pendingLabel="Guardando…" onClick={onSave} disabled={!dirty}
            className="min-w-28">
            Guardar
          </SubmitButton>
        )}
      </div>
    </div>
  );
}

function DiscardButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  return (
    <ConfirmDialog
      title="¿Descartar los cambios?"
      description="El packing list regresa a como estaba la última vez que se guardó. Lo que escribiste desde entonces se pierde."
      confirmLabel="Descartar"
      cancelLabel="Seguir editando"
      tone="destructive"
      onConfirm={onConfirm}
      trigger={
        <Button type="button" variant="ghost" className="touch-target" disabled={disabled}>
          <Undo2 className="size-4" aria-hidden />
          Descartar
        </Button>
      }
    />
  );
}

/** Lo que se descarga es lo guardado: con cambios pendientes, se dice. */
function statusMessage(dirty: boolean, saved: boolean): string {
  if (dirty) return "Cambios sin guardar. Guarda para exportarlos.";
  if (saved) return "Guardado. El PDF y el Excel salen de esta versión.";
  return "Sin editar: el PDF y el Excel salen de lo que dicen las cajas.";
}
