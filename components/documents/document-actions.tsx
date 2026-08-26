"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, Copy, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import type { DocumentStatus } from "@prisma/client";
import {
  applyDocumentAction,
  cancelDocumentAction,
  duplicateDocumentAction,
} from "@/app/actions/document.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  documentId: string;
  documentCode: string;
  status: DocumentStatus;
  lineCount: number;
  /** Renglones del desglose de corte. Una salida puede llevar sólo éstos. */
  cutLineCount?: number;
  /** Sólo las salidas tienen pantalla de corrección. */
  isIssue?: boolean;
}

/**
 * Acciones del documento según su estado.
 *
 * Un DRAFT se aplica; un APPLIED se cancela. Nunca se borra: cancelar genera
 * movimientos inversos, para que el kárdex conserve las dos caras.
 */
export function DocumentActions({
  documentId,
  documentCode,
  status,
  lineCount,
  cutLineCount = 0,
  isIssue,
}: Props) {
  const router = useRouter();

  /* Una salida sólo con desglose de cortes SÍ se puede aplicar: no mueve
     inventario, pero la marca como entregada en vez de dejarla en borrador. */
  const canApply = lineCount > 0 || (isIssue === true && cutLineCount > 0);

  const [isApplying, setIsApplying] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  async function handleApply() {
    setIsApplying(true);
    const result = await runAction(() => applyDocumentAction({ id: documentId }));
    setIsApplying(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`${documentCode} aplicado: se movió el inventario`);
    router.refresh();
  }

  /**
   * Copia el vale a un borrador nuevo y se va directo a corregirlo.
   *
   * Se abre la EDICIÓN y no la ficha porque duplicar nunca es el objetivo
   * final: se duplica para cambiar dos tallas. Dejar al auxiliar en la ficha
   * lo obligaría a un toque más para llegar a donde ya iba.
   */
  async function handleDuplicate() {
    setIsDuplicating(true);
    const result = await runAction(() =>
      duplicateDocumentAction({ id: documentId }),
    );
    setIsDuplicating(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const copy = result.data;
    toast.success(
      `${copy.code} creado como borrador a partir de ${documentCode}`,
    );

    // Las salidas tienen pantalla de corrección; los demás tipos no, y ahí la
    // ficha del borrador nuevo es lo más útil que se puede ofrecer.
    router.push(isIssue ? `/issues/${copy.id}/edit` : `/documents/${copy.id}`);
  }

  async function handleCancel() {
    if (!reason.trim()) {
      toast.error("Escribe el motivo de la cancelación.");
      return;
    }

    setIsCancelling(true);
    const result = await runAction(() => cancelDocumentAction({ id: documentId, reason: reason.trim() }));
    setIsCancelling(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Documento cancelado con movimientos inversos");
    setCancelOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className="touch-target">
        <a href={`/print/document/${documentId}`} target="_blank" rel="noopener">
          <Printer className="size-4" aria-hidden />
          Imprimir vale
        </a>
      </Button>

      {/* Disponible en CUALQUIER estado —borrador, aplicada o cancelada—:
          la copia nace en borrador y no toca existencias, así que duplicar
          una salida ya aplicada es tan inofensivo como capturarla de cero. */}
      <Button
        type="button"
        variant="outline"
        onClick={handleDuplicate}
        disabled={isDuplicating}
        className="touch-target"
      >
        <Copy className="size-4" aria-hidden />
        {isDuplicating ? "Duplicando…" : "Duplicar"}
      </Button>

      {/* Editar SÓLO en borrador: una salida aplicada ya movió inventario y
          corregirla dejaría el kárdex sin explicación. Ahí quedan imprimir y
          cancelar, que genera los movimientos inversos. */}
      {status === "DRAFT" && isIssue && (
        <Button asChild variant="outline" className="touch-target">
          <Link href={`/issues/${documentId}/edit`}>
            <Pencil className="size-4" aria-hidden />
            Editar
          </Link>
        </Button>
      )}

      {status === "DRAFT" && (
        <Button
          type="button"
          onClick={handleApply}
          disabled={isApplying || !canApply}
          className="touch-target"
        >
          <Check className="size-4" aria-hidden />
          {isApplying ? "Aplicando…" : "Aplicar"}
        </Button>
      )}

      {status !== "CANCELLED" && (
        <ResponsiveFormDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          title={`Cancelar ${documentCode}`}
          description={
            status === "APPLIED"
              ? "Se generarán movimientos inversos. Los originales no se borran."
              : "El borrador quedará cancelado."
          }
          trigger={
            <Button variant="outline" className="touch-target">
              <Ban className="size-4" aria-hidden />
              Cancelar
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cancel-reason">Motivo</Label>
              <Textarea
                id="cancel-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Se capturó el rollo equivocado"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              La cancelación se registra en la bitácora con sensibilidad
              crítica, tu nombre y este motivo.
            </p>

            <Button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling || !reason.trim()}
              className="h-12 w-full bg-destructive text-white hover:bg-destructive/90"
            >
              {isCancelling ? "Cancelando…" : "Confirmar cancelación"}
            </Button>
          </div>
        </ResponsiveFormDialog>
      )}
    </div>
  );
}
