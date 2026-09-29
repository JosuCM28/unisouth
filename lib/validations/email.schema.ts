import { z } from "zod";
import { cuidSchema, requiredText } from "./common";

/**
 * Una dirección de correo, ya en minúsculas.
 *
 * En minúsculas porque el buzón no distingue "Taller@X.com" de
 * "taller@x.com", y sin normalizar la misma persona podría quedar dada de
 * alta dos veces y recibir cada vale repetido.
 */
const emailSchema = z
  .string({ message: "Escribe el correo" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Escribe un correo válido, como taller@empresa.com"));

export const emailContactSchema = z.object({
  name: requiredText("El nombre", 80),
  email: emailSchema,
  active: z.boolean().default(true),
});

export type EmailContactInput = z.infer<typeof emailContactSchema>;

/**
 * Mandar un vale ya aplicado a los contactos elegidos.
 *
 * Los ids y no las direcciones, por la misma razón que en WhatsApp: el
 * servidor lee los correos de la tabla, así que nadie puede mandar el vale a
 * un buzón que ADMIN no dio de alta llamando a la action a mano.
 */
export const sendVoucherEmailSchema = z.object({
  documentId: cuidSchema,
  contactIds: z
    .array(cuidSchema)
    .min(1, "Elige al menos un correo")
    .max(20, "Son demasiados correos para un solo envío"),
});

export type SendVoucherEmailInput = z.infer<typeof sendVoucherEmailSchema>;
