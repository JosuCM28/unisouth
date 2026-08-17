"use client";

import { Pencil } from "lucide-react";
import type { Client } from "@prisma/client";
import { removeClientAction } from "@/app/actions/client.actions";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ClientFormDialog } from "./client-form-dialog";

export function ClientActions({ client }: { client: Client }) {
  return (
    <RowActions
      label={client.name}
      editItem={
        <ClientFormDialog
          client={client}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </DropdownMenuItem>
          }
        />
      }
      removeDescription="El cliente dejará de aparecer en los catálogos. El historial de su material se conserva. Si todavía tiene rollos en bodega, no se podrá dar de baja."
      onRemove={() =>
        removeClientAction({
          id: client.id,
          reason: `Baja del cliente ${client.name}`,
        })
      }
    />
  );
}
