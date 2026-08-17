"use client";

import { useState, type ReactNode } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/core/result";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RowActionsProps {
  /** Nombre visible del registro, para los textos de confirmación. */
  label: string;
  /** El diálogo de edición, que aporta su propio DropdownMenuItem. */
  editItem: ReactNode;
  onRemove: () => Promise<ActionResult<unknown>>;
  removeTitle?: string;
  removeDescription: string;
}

/**
 * Menú de fila: editar y dar de baja, con confirmación.
 *
 * El diálogo de confirmación NO se cierra solo al aceptar: espera la
 * respuesta del servidor, porque la baja puede ser rechazada por una regla
 * de negocio ("todavía tiene rollos encima") y el usuario debe leer por qué.
 */
export function RowActions({
  label,
  editItem,
  onRemove,
  removeTitle,
  removeDescription,
}: RowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleRemove() {
    setIsRemoving(true);
    const result = await onRemove();
    setIsRemoving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Dado de baja");
    setConfirmOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="touch-target"
            aria-label={`Acciones de ${label}`}
          >
            <MoreVertical className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {editItem}

          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            Dar de baja
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removeTitle ?? `¿Dar de baja ${label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>{removeDescription}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="touch-target">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Se evita el cierre automático: si el servidor rechaza la
                // baja, el diálogo debe quedarse abierto con el motivo.
                event.preventDefault();
                void handleRemove();
              }}
              disabled={isRemoving}
              className="touch-target bg-destructive text-white hover:bg-destructive/90"
            >
              {isRemoving ? "Dando de baja…" : "Dar de baja"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
