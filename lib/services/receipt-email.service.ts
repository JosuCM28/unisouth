import type { Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/core/errors";
import { ReceiptRepository } from "@/lib/repositories/receipt.repository";
import type { SendReceiptEmailInput } from "@/lib/validations/email.schema";
import {
  receiptEmailSubject,
  receiptEmailText,
} from "@/lib/receipts/receipt-email";
import {
  FIRST_ITEM_NUMBER,
  ITEM_SERIES,
  receiptRowKeys,
  receiptSummaryFileName,
  receiptSummaryXlsx,
  summarizeReceipt,
  type ReceiptForSummary,
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
        const itemNumbers = await this.assignItemNumbers(receipt.id, receipt);
        const summary = summarizeReceipt(receipt, itemNumbers, new Date());
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

  /**
   * El número de ítem de cada renglón: el que ya tenía, o el siguiente libre.
   *
   * Se aparta al armar el correo y no antes: si el canal está apagado o
   * falta la llave, no se gasta ningún número. Si Resend falla después, los
   * números ya quedaron y el reenvío sale con los mismos.
   */
  private async assignItemNumbers(
    receiptId: string,
    receipt: ReceiptForSummary,
  ): Promise<Record<string, number>> {
    return this.transaction(async (tx) => {
      const receipts = new ReceiptRepository(tx);
      await receipts.lockForUpdate(receiptId);

      // Se relee DESPUÉS del candado: otro envío pudo apartar mientras tanto.
      const current = await receipts.findById(receiptId);
      const numbers = toNumberMap(current?.mailedItemNumbers ?? null);

      const missing = receiptRowKeys(receipt).filter((key) => !(key in numbers));
      if (missing.length === 0) return numbers;

      const reserved = await this.sequencesWith(tx).reserveNumbers(
        ITEM_SERIES,
        missing.length,
        FIRST_ITEM_NUMBER,
      );
      missing.forEach((key, index) => {
        const item = reserved[index];
        if (item !== undefined) numbers[key] = item;
      });

      await receipts.saveMailedItemNumbers(receiptId, numbers);
      return numbers;
    });
  }
}

/** El JSON guardado, sólo con lo que de verdad es llave → número. */
function toNumberMap(value: Prisma.JsonValue): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}
