"use server";

import { executeAction } from "@/lib/core/action-handler";
import { receiptSchema } from "@/lib/validations/receipt.schema";
import { ReceiptService } from "@/lib/services/receipt.service";

export async function createReceiptAction(input: unknown) {
  return executeAction(input, {
    schema: receiptSchema,
    permission: "inventory:write",
    revalidate: ["/receipts", "/lots", "/dashboard"],
    successMessage: "Recepción registrada",
    handler: ({ input, auditContext }) => new ReceiptService(auditContext).create(input),
  });
}
