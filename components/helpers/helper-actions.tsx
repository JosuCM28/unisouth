"use client";

import { Pencil } from "lucide-react";
import type { Helper } from "@prisma/client";
import { removeHelperAction } from "@/app/actions/helper.actions";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { HelperFormDialog } from "./helper-form-dialog";

export function HelperActions({ helper }: { helper: Helper }) {
  return (
    <RowActions
      label={helper.name}
      editItem={
        <HelperFormDialog helper={helper}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Pencil className="size-4" aria-hidden />Editar
            </DropdownMenuItem>
          } />
      }
      removeDescription="Dejará de aparecer al registrar recepciones. Si ya descargó rollos no se podrá dar de baja, para no perder el historial de sus bonificaciones."
      onRemove={() => removeHelperAction({ id: helper.id, reason: `Baja de ${helper.name}` })}
    />
  );
}
