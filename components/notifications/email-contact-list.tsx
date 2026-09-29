import { Mail } from "lucide-react";
import type { EmailRecipient } from "@/lib/repositories/email-contact.repository";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { EmailContactActions } from "./email-contact-actions";

/** Los correos, uno por tarjeta, igual que los contactos de WhatsApp. */
export function EmailContactList({ contacts }: { contacts: EmailRecipient[] }) {
  if (contacts.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={Mail}
          title="Aún no hay correos"
          description="Agrega los correos a los que se les manda el vale al aplicar una salida."
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
            <p className="truncate text-xs text-muted-foreground">
              {contact.email}
              {!contact.active && " · no se marca solo"}
            </p>
          </div>
          <EmailContactActions contact={contact} />
        </li>
      ))}
    </ul>
  );
}
