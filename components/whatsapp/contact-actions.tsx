"use client";

import { Pencil } from "lucide-react";
import { removeWhatsappContactAction } from "@/app/actions/whatsapp.actions";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ContactFormDialog, type EditableContact } from "./contact-form-dialog";

export function ContactActions({ contact }: { contact: EditableContact }) {
  return (
    <RowActions
      label={contact.name}
      editItem={
        <ContactFormDialog
          contact={contact}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </DropdownMenuItem>
          }
        />
      }
      removeTitle={`Eliminar ${contact.name}`}
      removeDescription="Deja de aparecer al enviar una salida. Los envíos que ya se le hicieron siguen en la bitácora con su número."
      onRemove={() =>
        removeWhatsappContactAction({
          id: contact.id,
          reason: `Baja del contacto ${contact.name}`,
        })
      }
    />
  );
}
