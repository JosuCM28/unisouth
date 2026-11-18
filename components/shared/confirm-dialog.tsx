"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

type ConfirmTone = "default" | "destructive";

const TONE_CLASSES: Record<ConfirmTone, string> = {
  default: "",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
};

interface ConfirmDialogProps {
  /** El botón que abre la pregunta. */
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Texto del botón mientras corre la acción: "Quitando…". */
  pendingLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /**
   * Lo que se hace al aceptar. Devuelve `false` para dejar el diálogo
   * abierto —el servidor dijo que no y el usuario tiene que leer por qué
   * en el aviso—; cualquier otra cosa lo cierra.
   */
  onConfirm: () => Promise<boolean | void> | boolean | void;
}

/**
 * Pregunta antes de una acción que no se deshace sola.
 *
 * Reemplaza al `window.confirm` del navegador: aquél bloquea la pestaña,
 * no se le puede dar el estilo de la app y en el celular sale con el
 * dominio de la página como título, que el auxiliar no entiende.
 *
 * NO se cierra al aceptar hasta que la acción contesta: si quitar la caja
 * falla porque alguien le metió prenda mientras tanto, el diálogo se queda
 * y el botón vuelve a estar disponible.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancelar",
  tone = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  async function handleConfirm() {
    setRunning(true);
    try {
      const keepOpen = (await onConfirm()) === false;
      if (!keepOpen) setOpen(false);
    } finally {
      setRunning(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Mientras corre no se cierra: el resultado tiene que verse.
        if (!running) setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="touch-target" disabled={running}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn("touch-target", TONE_CLASSES[tone])}
            disabled={running}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {running && <Loader2 className="animate-spin" aria-hidden />}
            {running && pendingLabel ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
