"use client";

import { Pencil } from "lucide-react";
import type { Carrier, Supplier } from "@prisma/client";
import { removeCarrierAction, removeSupplierAction } from "@/app/actions/partner.actions";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { CarrierFormDialog } from "./carrier-form-dialog";
import { SupplierFormDialog } from "./supplier-form-dialog";

export function CarrierActions({ carrier }: { carrier: Carrier }) {
  return (
    <RowActions
      label={carrier.name}
      editItem={
        <CarrierFormDialog carrier={carrier}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Pencil className="size-4" aria-hidden />Editar
            </DropdownMenuItem>
          } />
      }
      removeDescription="Dejará de aparecer al registrar recepciones. El historial se conserva. Si ya trajo carga, no se podrá dar de baja."
      onRemove={() => removeCarrierAction({ id: carrier.id, reason: `Baja de ${carrier.name}` })}
    />
  );
}

export function SupplierActions({ supplier }: { supplier: Supplier }) {
  return (
    <RowActions
      label={supplier.name}
      editItem={
        <SupplierFormDialog supplier={supplier}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Pencil className="size-4" aria-hidden />Editar
            </DropdownMenuItem>
          } />
      }
      removeDescription="Dejará de aparecer en recepciones y requisiciones. El historial se conserva. Si ya tiene registros, no se podrá dar de baja."
      onRemove={() => removeSupplierAction({ id: supplier.id, reason: `Baja de ${supplier.name}` })}
    />
  );
}
