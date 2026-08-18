"use server";

import { executeAction } from "@/lib/core/action-handler";
import {
  receiptSchema,
  updateReceiptSchema,
} from "@/lib/validations/receipt.schema";
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

export async function updateReceiptAction(input: unknown) {
  return executeAction(input, {
    schema: updateReceiptSchema,
    permission: "inventory:write",
    // También el inventario: si cambió el dueño, los rollos de esta guía
    // salieron con otro cliente y la lista debe reflejarlo.
    revalidate: ["/receipts", "/lots", "/dashboard"],
    successMessage: "Recepción actualizada",
    handler: ({ input, auditContext }) =>
      new ReceiptService(auditContext).update(input),
  });
}
