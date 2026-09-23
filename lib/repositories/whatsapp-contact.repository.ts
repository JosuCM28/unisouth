import type { Prisma, WhatsappContact } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

/** Lo que se ofrece en el diálogo de envío: nombre, número y si va marcado. */
export type WhatsappRecipient = Pick<
  WhatsappContact,
  "id" | "name" | "phone" | "active"
>;

const RECIPIENT_SELECT = {
  id: true,
  name: true,
  phone: true,
  active: true,
} satisfies Prisma.WhatsappContactSelect;

export class WhatsappContactRepository extends BaseRepository<
  WhatsappContact,
  Prisma.WhatsappContactCreateInput,
  Prisma.WhatsappContactUpdateInput
> {
  /* Baja física: ningún registro apunta a un contacto, y el rastro de cada
     envío vive en AuditLog con el número escrito. */
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.whatsappContact;
  }

  protected get entityName(): string {
    return "el contacto";
  }

  /** Todos, activos primero: es el orden en que se piensan al enviar. */
  async findAll(): Promise<WhatsappRecipient[]> {
    return this.db.whatsappContact.findMany({
      select: RECIPIENT_SELECT,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
  }

  /** Los contactos elegidos en un envío, en el orden en que se eligieron. */
  async findByIds(ids: string[]): Promise<WhatsappRecipient[]> {
    const contacts = await this.db.whatsappContact.findMany({
      where: { id: { in: ids } },
      select: RECIPIENT_SELECT,
    });

    const byId = new Map(contacts.map((contact) => [contact.id, contact]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  /** ¿Ya existe ese número en otro contacto? */
  async phoneTaken(phone: string, excludeId?: string): Promise<boolean> {
    return this.exists({ phone }, excludeId);
  }
}
