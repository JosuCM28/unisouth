"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeOrderFolderAction } from "@/app/actions/order-folder.actions";
import { runAction } from "@/lib/offline/run-action";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  folderId: string;
  folderCode: string;
  /** Cuántas órdenes cuelgan del pedido. Con una sola ya no se puede borrar. */
  orderCount: number;
  className?: string;
}

/**
 * Borra un pedido, pero sólo si ya está vacío.
 *
 * Cuando todavía tiene órdenes el diálogo lo dice y no deja confirmar, en vez
 * de dejar apretar y devolver un error: la regla —vaciarlo primero, orden por
 * orden— se entiende mucho mejor leída antes que después.
 *
 * El servidor la vuelve a exigir de todos modos. Esto es la explicación, no
 * la cerradura.
 */
export function FolderDeleteButton({
  folderId,
  folderCode,
  orderCount,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEmpty = orderCount === 0;

  async function handleDelete() {
    setIsDeleting(true);
    const result = await runAction(() =>
      removeOrderFolderAction({ id: folderId }),
    );
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Pedido eliminado");
    setOpen(false);

    /* A la lista, no un refresh: este botón también vive dentro de la ficha
       del pedido, y refrescarla después de borrarlo dejaría al usuario en una
       ruta que ya no existe. Desde la lista, navegar a la lista no estorba. */
    router.push("/orders");
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Borrar ${folderCode}`}
      description={
        isEmpty
          ? "El pedido está vacío y se puede borrar. No se puede deshacer."
          : `Este pedido todavía tiene ${orderCount} ${orderCount === 1 ? "orden" : "órdenes"}.`
      }
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className={cn("touch-target shrink-0 text-muted-foreground", className)}
          aria-label={`Borrar ${folderCode}`}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {!isEmpty && (
          <p className="flat-surface p-3 text-sm text-muted-foreground">
            Ábrelo y borra o mueve sus órdenes una por una. Cuando quede vacío
            vas a poder borrarlo. Si sólo quieres que deje de estorbar en la
            lista, archívalo.
          </p>
        )}

        <Button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting || !isEmpty}
          className="h-12 w-full bg-destructive text-white hover:bg-destructive/90"
        >
          {isDeleting ? "Borrando…" : "Sí, borrar el pedido"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
