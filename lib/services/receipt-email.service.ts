import { NotFoundError } from "@/lib/core/errors";
import { ReceiptRepository } from "@/lib/repositories/receipt.repository";
import type { SendReceiptEmailInput } from "@/lib/validations/email.schema";
import {
  receiptEmailSubject,
  receiptEmailText,
} from "@/lib/receipts/receipt-email";
import {
  receiptSummaryFileName,
  receiptSummaryXlsx,
  summarizeReceipt,
} from "@/lib/receipts/receipt-summary";
import { BaseService } from "./base.service";
import { EmailDispatchService } from "./email-dispatch.service";
import type { VoucherDeliveryResult } from "./sendable-voucher";

/**
 * Manda por correo lo que llegó en una recepción: el Excel por tela y tono,
 * y el mismo resumen en el cuerpo.
 *
 * Va APARTE de guardarla, igual que el vale de salida: la recepción ya dio de
 * alta los rollos y no puede quedar esperando a un servidor de correo. Si el
 * envío falla, se reenvía desde la ficha de la recepción.
 */
export class ReceiptEmailService extends BaseService {
  async send(input: SendReceiptEmailInput): Promise<VoucherDeliveryResult> {
    const receipt = await new ReceiptRepository(this.db).findByIdWithLots(
      input.receiptId,
    );
    if (!receipt) throw new NotFoundError("la recepción", input.receiptId);

    return new EmailDispatchService(this.context, this.db).send({
      contactIds: input.contactIds,
      entity: "Receipt",
      entityId: receipt.id,
      reference: receipt.code,
      build: async () => {
        const summary = summarizeReceipt(receipt);
        return {
          subject: receiptEmailSubject(summary),
          text: receiptEmailText(summary),
          attachments: [
            {
              fileName: receiptSummaryFileName(summary),
              base64: receiptSummaryXlsx(summary).toString("base64"),
            },
          ],
        };
      },
    });
  }
}
