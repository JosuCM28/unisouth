"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { BoardColor } from "@/lib/constants/board-colors";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "./color-picker";

export interface BoardItemDraft {
  title: string;
  detail: string;
  color: BoardColor;
  /** Sólo lo usan las tarjetas del kanban; los objetivos lo dejan fuera. */
  tag?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  trigger: React.ReactNode;
  /** Presente = se está editando algo que ya existe. */
  initial?: BoardItemDraft;
  /** Muestra el campo de etiqueta ("Ternium", "pedido 4410"). */
  withTag?: boolean;
  onSubmit: (draft: BoardItemDraft) => Promise<boolean>;
}

const EMPTY: BoardItemDraft = { title: "", detail: "", color: "slate", tag: "" };

/**
 * Alta y edición de un objetivo o una tarjeta.
 *
 * El mismo diálogo para ambos porque los campos son casi iguales y mantener
 * dos formularios gemelos garantiza que se desincronicen. La única diferencia
 * —la etiqueta— entra por bandera.
 *
 * Sólo el título es obligatorio: anotar un pendiente tiene que costar menos
 * que apuntarlo en un papel, o el tablero se queda vacío.
 */
export function BoardItemDialog({
  open,
  onOpenChange,
  title,
  trigger,
  initial,
  withTag,
  onSubmit,
}: Props) {
  const [draft, setDraft] = useState<BoardItemDraft>(initial ?? EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    // Al abrir se recarga desde el original: si el usuario editó, cerró sin
    // guardar y volvió a abrir, vería sus cambios a medias como si estuvieran
    // guardados.
    if (next) setDraft(initial ?? EMPTY);
    onOpenChange(next);
  }

  async function handleSubmit() {
    if (!draft.title.trim()) {
      toast.error("Escribe al menos el título.");
      return;
    }

    setIsSubmitting(true);
    const ok = await onSubmit(draft);
    setIsSubmitting(false);

    if (ok) onOpenChange(false);
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      trigger={trigger}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="board-title">Título</Label>
          <Input
            id="board-title"
            value={draft.title}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
            placeholder="Preparar pedido de Ternium"
            className="touch-target"
            autoFocus
          />
        </div>

        {withTag && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="board-tag">Etiqueta</Label>
            <Input
              id="board-tag"
              value={draft.tag ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, tag: event.target.value })
              }
              placeholder="Ternium, pedido 4410…"
              className="touch-target"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="board-detail">Detalle</Label>
          <Textarea
            id="board-detail"
            rows={3}
            value={draft.detail}
            onChange={(event) =>
              setDraft({ ...draft, detail: event.target.value })
            }
            placeholder="Opcional"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Color</Label>
          <ColorPicker
            value={draft.color}
            onChange={(color) => setDraft({ ...draft, color })}
          />
        </div>

        <div className="flex gap-2">
          <SubmitButton
            type="button"
            onClick={handleSubmit}
            isSubmitting={isSubmitting}
            pendingLabel="Guardando…"
            className="h-12 flex-1"
          >
            Guardar
          </SubmitButton>

          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-12 touch-target"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </ResponsiveFormDialog>
  );
}
