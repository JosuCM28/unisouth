import type { EmailContact, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

/** Lo que se ofrece en el diálogo de envío: nombre, correo y si va marcado. */
export type EmailRecipient = Pick<
  EmailContact,
  "id" | "name" | "email" | "active"
>;

const RECIPIENT_SELECT = {
  id: true,
  name: true,
  email: true,
  active: true,
} satisfies Prisma.EmailContactSelect;

export class EmailContactRepository extends BaseRepository<
  EmailContact,
  Prisma.EmailContactCreateInput,
  Prisma.EmailContactUpdateInput
> {
  /* Baja física: ningún registro apunta a un contacto, y el rastro de cada
     envío vive en AuditLog con la dirección escrita. */
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.emailContact;
  }

  protected get entityName(): string {
    return "el correo";
  }

  /** Todos, activos primero: es el orden en que se piensan al enviar. */
  async findAll(): Promise<EmailRecipient[]> {
    return this.db.emailContact.findMany({
      select: RECIPIENT_SELECT,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
  }

  /** Los contactos elegidos en un envío, en el orden en que se eligieron. */
  async findByIds(ids: string[]): Promise<EmailRecipient[]> {
    const contacts = await this.db.emailContact.findMany({
      where: { id: { in: ids } },
      select: RECIPIENT_SELECT,
    });

    const byId = new Map(contacts.map((contact) => [contact.id, contact]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  /** ¿Ya existe esa dirección en otro contacto? */
  async emailTaken(email: string, excludeId?: string): Promise<boolean> {
    return this.exists({ email }, excludeId);
  }
}
