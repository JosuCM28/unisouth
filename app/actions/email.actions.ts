"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import {
  emailContactSchema,
  sendReceiptEmailSchema,
  sendVoucherEmailSchema,
} from "@/lib/validations/email.schema";
import { EmailContactService } from "@/lib/services/email-contact.service";
import { ReceiptEmailService } from "@/lib/services/receipt-email.service";
import { VoucherEmailService } from "@/lib/services/voucher-email.service";

const NOTIFICATIONS_PATH = "/notifications";

const updateContactSchema = z.object({
  id: cuidSchema,
  data: emailContactSchema,
});

export async function createEmailContactAction(input: unknown) {
  return executeAction(input, {
    schema: emailContactSchema,
    permission: "notifications:write",
    revalidate: [NOTIFICATIONS_PATH],
    successMessage: "Correo agregado",
    handler: ({ input, auditContext }) =>
      new EmailContactService(auditContext).create(input),
  });
}

export async function updateEmailContactAction(input: unknown) {
  return executeAction(input, {
    schema: updateContactSchema,
    permission: "notifications:write",
    revalidate: [NOTIFICATIONS_PATH],
    successMessage: "Correo actualizado",
    handler: ({ input, auditContext }) =>
      new EmailContactService(auditContext).update(input.id, input.data),
  });
}

export async function removeEmailContactAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "notifications:write",
    revalidate: [NOTIFICATIONS_PATH],
    successMessage: "Correo eliminado",
    handler: ({ input, auditContext }) =>
      new EmailContactService(auditContext).remove(input.id, input.reason),
  });
}

/**
 * Manda por correo el PDF de una salida ya aplicada.
 *
 * Pide `inventory:write` —la misma llave con la que se aplica—, igual que
 * WhatsApp: quien aplica la salida es quien la manda. A qué buzones puede
 * llegar lo decide ADMIN, y eso lo garantiza que aquí viajen ids.
 */
export async function sendVoucherEmailAction(input: unknown) {
  return executeAction(input, {
    schema: sendVoucherEmailSchema,
    permission: "inventory:write",
    handler: ({ input, auditContext }) =>
      new VoucherEmailService(auditContext).send(input),
  });
}

/**
 * Manda por correo el resumen de una recepción ya guardada.
 *
 * `inventory:write`, la llave con la que se captura la recepción: quien la
 * registra es quien avisa que llegó.
 */
export async function sendReceiptEmailAction(input: unknown) {
  return executeAction(input, {
    schema: sendReceiptEmailSchema,
    permission: "inventory:write",
    handler: ({ input, auditContext }) =>
      new ReceiptEmailService(auditContext).send(input),
  });
}
