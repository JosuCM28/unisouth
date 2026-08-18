import { z } from "zod";
import { optionalText } from "./common";

/**
 * Un foleo: el papelito de color que se engrapa al bulto.
 *
 * El color se valida como hex porque va tal cual al `style` de la celda, en
 * pantalla y en la hoja impresa. Un valor libre ahí rompería el contraste
 * calculado o, peor, permitiría inyectar CSS.
 */
export const cutTagSchema = z.object({
  name: z
    .string({ message: "Escribe el nombre del color" })
    .trim()
    .min(1, "Escribe el nombre del color")
    .max(40, "El nombre es muy largo"),
  color: z
    .string({ message: "Elige el color" })
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "El color debe ser un hex como #1d4ed8"),
  /** Orden en que se ofrecen. Los más usados arriba. */
  order: z.coerce.number().int().min(0).default(0),
  code: optionalText,
});

export type CutTagInput = z.infer<typeof cutTagSchema>;
