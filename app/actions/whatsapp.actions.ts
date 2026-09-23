"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import {
  sendVoucherWhatsappSchema,
  whatsappContactSchema,
} from "@/lib/validations/whatsapp.schema";
import { VoucherWhatsappService } from "@/lib/services/voucher-whatsapp.service";
import { WhatsappContactService } from "@/lib/services/whatsapp-contact.service";

const CONTACTS_PATH = "/whatsapp-contacts";

const updateContactSchema = z.object({
  id: cuidSchema,
  data: whatsappContactSchema,
});

export async function createWhatsappContactAction(input: unknown) {
  return executeAction(input, {
    schema: whatsappContactSchema,
    permission: "whatsapp:write",
    revalidate: [CONTACTS_PATH],
    successMessage: "Contacto agregado",
    handler: ({ input, auditContext }) =>
      new WhatsappContactService(auditContext).create(input),
  });
}

export async function updateWhatsappContactAction(input: unknown) {
  return executeAction(input, {
    schema: updateContactSchema,
    permission: "whatsapp:write",
    revalidate: [CONTACTS_PATH],
    successMessage: "Contacto actualizado",
    handler: ({ input, auditContext }) =>
      new WhatsappContactService(auditContext).update(input.id, input.data),
  });
}

export async function removeWhatsappContactAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "whatsapp:write",
    revalidate: [CONTACTS_PATH],
    successMessage: "Contacto eliminado",
    handler: ({ input, auditContext }) =>
      new WhatsappContactService(auditContext).remove(input.id, input.reason),
  });
}

/**
 * Manda por WhatsApp el PDF de una salida ya aplicada.
 *
 * Pide `inventory:write` —la misma llave con la que se aplica— y no
 * `whatsapp:write`: quien aplica la salida es quien la manda. Lo que sólo
 * ADMIN decide es a qué números puede llegar, y eso lo garantiza que aquí
 * viajen ids de contactos y no teléfonos.
 */
export async function sendVoucherWhatsappAction(input: unknown) {
  return executeAction(input, {
    schema: sendVoucherWhatsappSchema,
    permission: "inventory:write",
    handler: ({ input, auditContext }) =>
      new VoucherWhatsappService(auditContext).send(input),
  });
}
