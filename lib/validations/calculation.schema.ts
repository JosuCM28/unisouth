import { z } from "zod";
import { cuidSchema, optionalCuid, optionalText, percentage } from "./common";

/**
 * Una línea del cálculo: "500 overoles talla G de esta ficha técnica".
 *
 * Las piezas son enteras: no se producen 2.5 overoles.
 */
export const calculationLineSchema = z.object({
  productId: cuidSchema,
  bomId: cuidSchema,
  quantity: z.coerce
    .number({ message: "Escribe cuántas piezas" })
    .int("Las piezas deben ser un número entero")
    .positive("Deben ser más de cero piezas"),
  sizeId: optionalCuid,
  variantId: optionalCuid,
});

export type CalculationLineInput = z.infer<typeof calculationLineSchema>;

export const calculationFormSchema = z.object({
  name: optionalText,
  productionRunId: optionalCuid,
  clientId: optionalCuid,

  // Mermas y margen. Se COMPONEN, no se suman: 5% sobre 3% no es 8%.
  globalWastePct: percentage.optional().default(0),
  safetyMarginPct: percentage.optional().default(0),

  /**
   * Si se respeta el dueño del material. Por omisión sí: la tela es del
   * cliente que manda a maquilar y jamás se surte a la producción de otro.
   */
  respectOwnership: z.boolean().default(true),
  includeRemnants: z.boolean().default(true),

  lines: z
    .array(calculationLineSchema)
    .min(1, "Agrega al menos un producto al cálculo"),

  notes: optionalText,
});

export type CalculationFormInput = z.infer<typeof calculationFormSchema>;
