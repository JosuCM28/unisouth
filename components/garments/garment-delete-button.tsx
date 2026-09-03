"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  removeGarmentAction,
  removeGarmentFolderAction,
  removePlacementAction,
} from "@/app/actions/garment.actions";
import { runAction } from "@/lib/offline/run-action";
import type { ActionResult } from "@/lib/core/result";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";

/** Qué se está borrando. Decide la action y lo que dice el diálogo. */
type Target = "folder" | "garment" | "placement";

interface Props {
  target: Target;
  id: string;
  /** Cómo se llama, para que el diálogo diga qué se lleva. */
  name: string;
  trigger: ReactNode;
  /** A dónde ir después. Sin esto sólo se refresca la pantalla. */
  redirectTo?: string;
  /** Aviso extra: las fotos que se van, las prendas que estorban. */
  warning?: ReactNode;
}

const ACTIONS: Record<
  Target,
  (id: string) => Promise<ActionResult<unknown>>
> = {
  folder: (id) => removeGarmentFolderAction({ id }),
  garment: (id) => removeGarmentAction({ id }),
  placement: (id) => removePlacementAction({ id }),
};

const TITLES: Record<Target, string> = {
  folder: "Borrar la carpeta",
  garment: "Borrar la prenda",
  placement: "Quitar el marcado",
};

/**
 * Lo que de verdad pasa al borrar cada cosa, dicho antes de apretar.
 *
 * Son tres comportamientos distintos y el usuario no puede adivinarlos: la
 * carpeta y la prenda se dan de baja y se pueden recuperar de la base; el
 * marcado se borra de verdad, con su foto, porque es un renglón de una lista
 * que se está armando y no una ficha con historia.
 */
const DESCRIPTIONS: Record<Target, string> = {
  folder: "Deja de aparecer en la lista. Sus datos quedan guardados.",
  garment: "Deja de aparecer en la carpeta. Sus marcados y fotos se conservan.",
  placement: "Se quita de la lista junto con su foto. Esto no se deshace.",
};

export function GarmentDeleteButton({
  target,
  id,
  name,
  trigger,
  redirectTo,
  warning,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await runAction(() => ACTIONS[target](id));
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Listo");
    setOpen(false);

    if (redirectTo) {
      router.push(redirectTo);
      return;
    }

    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={`${TITLES[target]}: ${name}`}
      description={DESCRIPTIONS[target]}
    >
      <div className="flex flex-col gap-4">
        {warning && (
          <div className="flat-surface p-3 text-sm text-muted-foreground">
            {warning}
          </div>
        )}

        <Button
          type="button"
          variant="destructive"
          className="h-12 w-full"
          disabled={isDeleting}
          onClick={handleDelete}
        >
          {isDeleting ? "Borrando…" : "Sí, borrar"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="touch-target w-full"
          onClick={() => setOpen(false)}
        >
          Mejor no
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
