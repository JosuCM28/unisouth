import type { WhatsappContact } from "@prisma/client";
import { DuplicateError, NotFoundError } from "@/lib/core/errors";
import { WhatsappContactRepository } from "@/lib/repositories/whatsapp-contact.repository";
import type { WhatsappContactInput } from "@/lib/validations/whatsapp.schema";
import { BaseService } from "./base.service";

/**
 * La lista de números a los que se manda el vale.
 *
 * Cada alta, cambio y baja se audita como MEDIUM: esos números reciben datos
 * del cliente, y "¿quién metió este número?" es la pregunta que se hace el día
 * que un vale llega a donde no debía.
 */
export class WhatsappContactService extends BaseService {
  async create(input: WhatsappContactInput): Promise<WhatsappContact> {
    return this.transaction(async (tx) => {
      const contacts = new WhatsappContactRepository(tx);
      await this.requireFreePhone(contacts, input.phone);

      const contact = await contacts.create(input);

      await this.auditWith(tx).record({
        entity: "WhatsappContact",
        entityId: contact.id,
        action: "CREATE",
        reference: contact.name,
        newValue: contact,
        sensitivity: "MEDIUM",
      });

      return contact;
    });
  }

  async update(id: string, input: WhatsappContactInput): Promise<WhatsappContact> {
    return this.transaction(async (tx) => {
      const contacts = new WhatsappContactRepository(tx);
      const before = await contacts.findByIdOrThrow(id);
      await this.requireFreePhone(contacts, input.phone, id);

      const contact = await contacts.update(id, input);

      await this.auditWith(tx).record({
        entity: "WhatsappContact",
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

  async remove(id: string, reason?: string): Promise<WhatsappContact> {
    return this.transaction(async (tx) => {
      const contacts = new WhatsappContactRepository(tx);
      const before = await contacts.findById(id);
      if (!before) throw new NotFoundError("el contacto", id);

      await contacts.delete(id);

      await this.auditWith(tx).record({
        entity: "WhatsappContact",
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

  /**
   * Un número, un contacto. Dos con el mismo número harían que la misma
   * persona recibiera el vale dos veces cada vez.
   */
  private async requireFreePhone(
    contacts: WhatsappContactRepository,
    phone: string,
    excludeId?: string,
  ) {
    if (await contacts.phoneTaken(phone, excludeId)) {
      throw new DuplicateError("un contacto", "el número", phone, "phone");
    }
  }
}
