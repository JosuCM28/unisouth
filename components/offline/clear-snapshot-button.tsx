"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearSnapshot } from "@/lib/offline/sync-engine";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Borra la copia de este equipo. Pide confirmación porque, sin señal, no
 * hay forma de volver a bajarla hasta que regrese el internet.
 */
export function ClearSnapshotButton({
  disabled,
  onCleared,
}: {
  disabled: boolean;
  onCleared: () => void;
}) {
  const [open, setOpen] = useState(false);

  async function handleClear() {
    try {
      await clearSnapshot();
      toast.success("Se borró la copia de este equipo");
      onCleared();
    } catch (error) {
      console.error("[offline] No se pudo borrar la copia:", error);
      toast.error("No se pudo borrar la copia. Intenta de nuevo.");
    } finally {
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="touch-target"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden />
        Borrar copia
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar la copia de este equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              Sin la copia no se puede consultar nada sin internet hasta volver
              a descargarla. Las capturas por subir NO se borran.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="touch-target">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="touch-target"
              onClick={(event) => {
                event.preventDefault();
                void handleClear();
              }}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
