import { z } from "zod";
import { optionalText, requiredText } from "./common";

/**
 * Ayudante de descarga.
 *
 * Sólo el nombre es obligatorio: se le da de alta con el camión ya en el
 * andén, y pedirle teléfono y código en ese momento haría que nadie lo
 * registre.
 */
export const helperSchema = z.object({
  name: requiredText("El nombre", 120),
  code: optionalText,
  phone: optionalText,
  notes: optionalText,
  active: z.boolean().default(true),
});

export type HelperInput = z.infer<typeof helperSchema>;

export const helperFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  code: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean(),
});

export type HelperFormValues = z.infer<typeof helperFormSchema>;
