import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { cuidSchema, requiredText } from "./common";

/** Un número normalizado: de 11 a 15 dígitos es un número internacional. */
const phoneSchema = z
  .string({ message: "Escribe el número" })
  .transform(normalizePhone)
  .refine(
    (phone) => phone.length >= 11 && phone.length <= 15,
    "Escribe los 10 dígitos del celular, o el número con su lada",
  );

export const whatsappContactSchema = z.object({
  name: requiredText("El nombre", 80),
  phone: phoneSchema,
  active: z.boolean().default(true),
});

export type WhatsappContactInput = z.infer<typeof whatsappContactSchema>;

/**
 * Mandar un vale ya aplicado a los contactos elegidos.
 *
 * Los ids y no los números: el servidor lee los números de la tabla, así que
 * nadie puede mandar el vale a un número que ADMIN no dio de alta llamando a
 * la action con un teléfono inventado.
 */
export const sendVoucherWhatsappSchema = z.object({
  documentId: cuidSchema,
  contactIds: z
    .array(cuidSchema)
    .min(1, "Elige al menos un contacto")
    .max(20, "Son demasiados contactos para un solo envío"),
});

export type SendVoucherWhatsappInput = z.infer<typeof sendVoucherWhatsappSchema>;
