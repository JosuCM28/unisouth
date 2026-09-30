import {
  ResendClient,
  type EmailAttachment,
} from "@/lib/core/resend-client";
import { BusinessRuleError, DomainError } from "@/lib/core/errors";
import {
  EmailContactRepository,
  type EmailRecipient,
} from "@/lib/repositories/email-contact.repository";
import { BaseService } from "./base.service";
import { NotificationSettingsService } from "./notification-settings.service";
import type { VoucherDeliveryResult } from "./sendable-voucher";

/** Lo que dice el correo. Se arma DESPUÉS de revisar que se puede enviar. */
export interface EmailContent {
  subject: string;
  text: string;
  attachments: EmailAttachment[];
}

export interface EmailDispatchInput {
  contactIds: string[];
  /** Qué se mandó, para la bitácora: "InventoryDocument", "Receipt"… */
  entity: string;
  entityId: string;
  /** El folio, que es como se busca en la bitácora. */
  reference: string;
  /**
   * Arma el contenido. Perezoso a propósito: el PDF o el Excel no se generan
   * si el canal está apagado, falta la llave o los contactos ya no existen.
   */
  build: () => Promise<EmailContent>;
}

/**
 * Manda UN correo a los contactos elegidos y deja rastro en la bitácora.
 *
 * Es lo que tienen en común el vale de salida y la recepción: los dos
 * respetan el interruptor de Notificaciones, leen las direcciones de la
 * tabla —nunca del navegador— y registran a qué buzón salió cada envío.
 * Cada uno sólo aporta qué dice su correo.
 *
 * UN solo correo con todos los destinatarios, no uno por persona: Resend
 * limita los envíos por segundo, y cinco seguidos pueden toparse con ese
 * límite a la mitad y dejar a unos con el archivo y a otros sin él.
 */
export class EmailDispatchService extends BaseService {
  async send(input: EmailDispatchInput): Promise<VoucherDeliveryResult> {
    await new NotificationSettingsService(this.context, this.db).requireEnabled(
      "email",
    );
    const client = requireClient();
    const recipients = await this.loadRecipients(input.contactIds);
    const names = recipients.map((recipient) => recipient.name);

    let error: string | null = null;
    try {
      const content = await input.build();
      await client.send({
        to: recipients.map((recipient) => recipient.email),
        ...content,
      });
    } catch (caught) {
      error = reasonOf(caught);
    }

    await this.recordSend(input, recipients, error);

    if (error === null) return { sent: names, failed: [] };
    return {
      sent: [],
      failed: names.map((name) => ({ name, reason: error })),
    };
  }

  private async loadRecipients(ids: string[]): Promise<EmailRecipient[]> {
    const recipients = await new EmailContactRepository(this.db).findByIds(ids);

    if (recipients.length === 0) {
      throw new BusinessRuleError(
        "Esos correos ya no existen. Vuelve a abrir el diálogo y elígelos otra vez.",
      );
    }

    return recipients;
  }

  /**
   * Con la dirección escrita y no sólo el nombre: si mañana alguien cambia
   * un correo, la bitácora sigue diciendo a qué buzón salió ESTE envío.
   */
  private async recordSend(
    input: EmailDispatchInput,
    recipients: EmailRecipient[],
    error: string | null,
  ) {
    const labels = recipients.map((r) => `${r.name} (${r.email})`);

    await this.audit.record({
      entity: input.entity,
      entityId: input.entityId,
      action: "EXPORT",
      reference: input.reference,
      newValue: {
        via: "Correo",
        enviados: error === null ? labels : [],
        fallidos: error === null ? [] : labels.map((l) => `${l}: ${error}`),
      },
      sensitivity: "LOW",
    });
  }
}

/** El cliente de Resend, o un error que se lee en pantalla. */
function requireClient(): ResendClient {
  const client = ResendClient.fromEnv();
  if (client) return client;

  throw new BusinessRuleError(
    "El correo no está configurado. Falta la variable RESEND_API_KEY en el servidor.",
  );
}

/** Un DomainError ya viene redactado; cualquier otra cosa es un bug. */
function reasonOf(error: unknown): string {
  if (error instanceof DomainError) return error.message;

  console.error("[EmailDispatchService] Error inesperado al enviar:", error);
  return "Error inesperado al enviar.";
}
