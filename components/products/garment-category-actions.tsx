"use client";

import { Pencil } from "lucide-react";
import { removeGarmentCategoryAction } from "@/app/actions/garment-category.actions";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  GarmentCategoryFormDialog,
  type EditableGarmentCategory,
} from "./garment-category-form-dialog";

export function GarmentCategoryActions({ category }: { category: EditableGarmentCategory }) {
  return (
    <RowActions
      label={category.name}
      editItem={
        <GarmentCategoryFormDialog
          category={category}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </DropdownMenuItem>
          }
        />
      }
      removeDescription="Deja de ofrecerse al dar de alta productos. Los que ya lo llevan lo conservan."
      onRemove={() =>
        removeGarmentCategoryAction({ id: category.id, reason: `Baja del tipo ${category.name}` })
      }
    />
  );
}
