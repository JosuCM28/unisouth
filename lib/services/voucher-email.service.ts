import { ResendClient } from "@/lib/core/resend-client";
import { BusinessRuleError, DomainError } from "@/lib/core/errors";
import {
  EmailContactRepository,
  type EmailRecipient,
} from "@/lib/repositories/email-contact.repository";
import type { SendVoucherEmailInput } from "@/lib/validations/email.schema";
import { renderVoucherPdf } from "@/lib/vouchers/voucher-pdf";
import {
  voucherEmailSubject,
  voucherEmailText,
} from "@/lib/vouchers/voucher-email";
import { voucherFileName } from "@/lib/vouchers/voucher-sheet";
import { BaseService } from "./base.service";
import { NotificationSettingsService } from "./notification-settings.service";
import { SendableVoucher, type VoucherDeliveryResult } from "./sendable-voucher";

/**
 * Manda el PDF de UN vale aplicado por correo.
 *
 * Igual que WhatsApp, va APARTE de aplicar y nunca dentro de su
 * transacción: aplicar mueve inventario y no puede quedar esperando a un
 * servidor de correo. Si el envío falla, la salida sigue aplicada y se
 * reenvía desde su ficha.
 *
 * UN solo correo con todos los destinatarios, no uno por persona: Resend
 * limita los envíos por segundo, y cinco correos seguidos pueden toparse con
 * ese límite a la mitad y dejar a unos con vale y a otros sin él.
 */
export class VoucherEmailService extends BaseService {
  async send(input: SendVoucherEmailInput): Promise<VoucherDeliveryResult> {
    await new NotificationSettingsService(this.context, this.db).requireEnabled(
      "email",
    );
    const client = requireClient();
    const sheet = await new SendableVoucher(this.db).load(input.documentId);
    const recipients = await this.loadRecipients(input.contactIds);
    const names = recipients.map((recipient) => recipient.name);

    let error: string | null = null;
    try {
      const pdf = await renderVoucherPdf(sheet);
      await client.send({
        to: recipients.map((recipient) => recipient.email),
        subject: voucherEmailSubject(sheet),
        text: voucherEmailText(sheet),
        attachments: [
          { fileName: voucherFileName(sheet), base64: pdf.toString("base64") },
        ],
      });
    } catch (caught) {
      error = reasonOf(caught);
    }

    await this.recordSend(input.documentId, sheet.code, recipients, error);

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
        "Esos correos ya no existen. Vuelve a abrir el vale y elígelos otra vez.",
      );
    }

    return recipients;
  }

  /**
   * Queda en la bitácora a quién se mandó, con la dirección escrita: si
   * mañana alguien cambia un correo, la bitácora sigue diciendo a qué buzón
   * salió ESTE vale.
   */
  private async recordSend(
    documentId: string,
    code: string,
    recipients: EmailRecipient[],
    error: string | null,
  ) {
    const labels = recipients.map((r) => `${r.name} (${r.email})`);

    await this.audit.record({
      entity: "InventoryDocument",
      entityId: documentId,
      action: "EXPORT",
      reference: code,
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

  console.error("[VoucherEmailService] Error inesperado al enviar:", error);
  return "Error inesperado al enviar.";
}
