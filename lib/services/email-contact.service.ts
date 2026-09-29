import type { EmailContact } from "@prisma/client";
import { DuplicateError, NotFoundError } from "@/lib/core/errors";
import { EmailContactRepository } from "@/lib/repositories/email-contact.repository";
import type { EmailContactInput } from "@/lib/validations/email.schema";
import { BaseService } from "./base.service";

/**
 * La lista de correos a los que se manda el vale.
 *
 * Auditada como MEDIUM, igual que los números de WhatsApp: esos buzones
 * reciben datos del cliente, y "¿quién metió este correo?" es la pregunta del
 * día en que un vale llega a donde no debía.
 */
export class EmailContactService extends BaseService {
  async create(input: EmailContactInput): Promise<EmailContact> {
    return this.transaction(async (tx) => {
      const contacts = new EmailContactRepository(tx);
      await this.requireFreeEmail(contacts, input.email);

      const contact = await contacts.create(input);

      await this.auditWith(tx).record({
        entity: "EmailContact",
        entityId: contact.id,
        action: "CREATE",
        reference: contact.name,
        newValue: contact,
        sensitivity: "MEDIUM",
      });

      return contact;
    });
  }

  async update(id: string, input: EmailContactInput): Promise<EmailContact> {
    return this.transaction(async (tx) => {
      const contacts = new EmailContactRepository(tx);
      const before = await contacts.findByIdOrThrow(id);
      await this.requireFreeEmail(contacts, input.email, id);

      const contact = await contacts.update(id, input);

      await this.auditWith(tx).record({
        entity: "EmailContact",
        entityId: id,
        action: "UPDATE",
        reference: contact.name,
        oldValue: before,
        newValue: contact,
        sensitivity: "MEDIUM",
      });

      return contact;
    });
  }

  async remove(id: string, reason?: string): Promise<EmailContact> {
    return this.transaction(async (tx) => {
      const contacts = new EmailContactRepository(tx);
      const before = await contacts.findById(id);
      if (!before) throw new NotFoundError("el correo", id);

      await contacts.delete(id);

      await this.auditWith(tx).record({
        entity: "EmailContact",
        entityId: id,
        action: "DELETE",
        reference: before.name,
        oldValue: before,
        sensitivity: "MEDIUM",
        reason,
      });

      return before;
    });
  }

  /** Un correo, un contacto: dos iguales recibirían cada vale repetido. */
  private async requireFreeEmail(
    contacts: EmailContactRepository,
    email: string,
    excludeId?: string,
  ) {
    if (await contacts.emailTaken(email, excludeId)) {
      throw new DuplicateError("un contacto", "el correo", email, "email");
    }
  }
}
