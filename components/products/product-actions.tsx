"use client";

import { Pencil } from "lucide-react";
import type { FinishedProduct } from "@prisma/client";
import { removeProductAction } from "@/app/actions/product.actions";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ProductFormDialog } from "./product-form-dialog";

interface Props {
  product: FinishedProduct;
  clients: { id: string; name: string }[];
}

export function ProductActions({ product, clients }: Props) {
  return (
    <RowActions
      label={product.name}
      editItem={
        <ProductFormDialog
          product={product}
          clients={clients}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </DropdownMenuItem>
          }
        />
      }
      removeDescription="El producto dejará de aparecer en Cálculo y en Salidas. Los cálculos que ya lo usaron conservan sus números."
      onRemove={() =>
        removeProductAction({
          id: product.id,
          reason: `Baja del producto ${product.code}`,
        })
      }
    />
  );
}
