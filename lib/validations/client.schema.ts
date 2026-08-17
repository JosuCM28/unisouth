import { z } from "zod";
import { optionalText, requiredText } from "./common";

/**
 * Cliente: dueño del material.
 *
 * Sólo el nombre es obligatorio. Los datos fiscales llegan después, cuando
 * facturación los pide; exigirlos al dar de alta frenaría la recepción.
 */
export const clientSchema = z.object({
  name: requiredText("El nombre", 160),
  code: optionalText,
  legalName: optionalText,
  taxId: optionalText,
  contact: optionalText,
  phone: optionalText,
  email: optionalText,
  notes: optionalText,
  active: z.boolean().default(true),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const clientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(160, "El nombre no puede pasar de 160 caracteres"),
  code: z.string().optional(),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;
