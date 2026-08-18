"use client";

import { Pencil } from "lucide-react";
import { removeCutTagAction } from "@/app/actions/cut-tag.actions";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { CutTagFormDialog, type EditableCutTag } from "./cut-tag-form-dialog";

export function CutTagActions({ tag }: { tag: EditableCutTag }) {
  return (
    <RowActions
      label={tag.name}
      editItem={
        <CutTagFormDialog
          tag={tag}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </DropdownMenuItem>
          }
        />
      }
      removeDescription="El foleo dejará de ofrecerse al capturar una salida. Los vales que ya lo usaron lo conservan, para que la hoja impresa siga cuadrando con el bulto."
      onRemove={() =>
        removeCutTagAction({
          id: tag.id,
          reason: `Baja del foleo ${tag.name}`,
        })
      }
    />
  );
}
