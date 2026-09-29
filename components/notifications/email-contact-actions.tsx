"use client";

import { Pencil } from "lucide-react";
import { removeEmailContactAction } from "@/app/actions/email.actions";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  EmailContactFormDialog,
  type EditableEmailContact,
} from "./email-contact-form-dialog";

export function EmailContactActions({
  contact,
}: {
  contact: EditableEmailContact;
}) {
  return (
    <RowActions
      label={contact.name}
      editItem={
        <EmailContactFormDialog
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
      removeDescription="Deja de aparecer al enviar una salida. Los envíos que ya se le hicieron siguen en la bitácora con su correo."
      onRemove={() =>
        removeEmailContactAction({
          id: contact.id,
          reason: `Baja del correo ${contact.name}`,
        })
      }
    />
  );
}
