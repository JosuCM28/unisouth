"use client";

import { Pencil } from "lucide-react";
import type { Material } from "@prisma/client";
import type { PlainObject } from "@/lib/utils";
import { removeMaterialAction } from "@/app/actions/material.actions";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MaterialFormDialog } from "./material-form-dialog";

export function MaterialActions({ material }: { material: PlainObject<Material> }) {
  return (
    <RowActions
      label={material.code}
      editItem={
        <MaterialFormDialog
          material={material}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </DropdownMenuItem>
          }
        />
      }
      removeDescription="El material dejará de aparecer en los catálogos. El historial de los rollos que lo usaron se conserva. Si todavía tiene existencia, no se podrá dar de baja."
      onRemove={() =>
        removeMaterialAction({
          id: material.id,
          reason: `Baja del material ${material.code}`,
        })
      }
    />
  );
}
