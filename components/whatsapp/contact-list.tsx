import { MessageCircle } from "lucide-react";
import type { WhatsappRecipient } from "@/lib/repositories/whatsapp-contact.repository";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { ContactActions } from "./contact-actions";

/**
 * Los contactos, uno por tarjeta.
 *
 * Tarjetas y no tabla en todos los tamaños: son dos datos por contacto y una
 * lista de cinco, y una tabla sólo agregaría encabezados que nadie lee.
 */
export function ContactList({ contacts }: { contacts: WhatsappRecipient[] }) {
  if (contacts.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={MessageCircle}
          title="Aún no hay contactos"
          description="Agrega los números a los que se les manda el vale al aplicar una salida."
        />
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {contacts.map((contact) => (
        <li
          key={contact.id}
          className={cn(
            "flat-surface flex items-center gap-3 p-3",
            !contact.active && "text-muted-foreground",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{contact.name}</p>
            <p className="tabular text-xs text-muted-foreground">
              {formatPhone(contact.phone)}
              {!contact.active && " · no se marca solo"}
            </p>
          </div>

          <ContactActions contact={contact} />
        </li>
      ))}
    </ul>
  );
}
