import type { SendVoucherEmailInput } from "@/lib/validations/email.schema";
import { renderVoucherPdf } from "@/lib/vouchers/voucher-pdf";
import {
  voucherEmailSubject,
  voucherEmailText,
} from "@/lib/vouchers/voucher-email";
import { voucherFileName } from "@/lib/vouchers/voucher-sheet";
import { BaseService } from "./base.service";
import { EmailDispatchService } from "./email-dispatch.service";
import { SendableVoucher, type VoucherDeliveryResult } from "./sendable-voucher";

/**
 * Manda el PDF de UN vale aplicado por correo.
 *
 * Igual que WhatsApp, va APARTE de aplicar y nunca dentro de su
 * transacción: aplicar mueve inventario y no puede quedar esperando a un
 * servidor de correo. Si el envío falla, la salida sigue aplicada y se
 * reenvía desde su ficha.
 */
export class VoucherEmailService extends BaseService {
  async send(input: SendVoucherEmailInput): Promise<VoucherDeliveryResult> {
    // Antes de despachar: un vale en borrador ni siquiera llega a la bitácora.
    const sheet = await new SendableVoucher(this.db).load(input.documentId);

    return new EmailDispatchService(this.context, this.db).send({
      contactIds: input.contactIds,
      entity: "InventoryDocument",
      entityId: input.documentId,
      reference: sheet.code,
      build: async () => {
        const pdf = await renderVoucherPdf(sheet);
        return {
          subject: voucherEmailSubject(sheet),
          text: voucherEmailText(sheet),
          attachments: [
            { fileName: voucherFileName(sheet), base64: pdf.toString("base64") },
          ],
        };
      },
    });
  }
}
