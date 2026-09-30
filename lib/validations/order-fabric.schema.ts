import { z } from "zod";
import { cuidSchema, optionalText, positiveQuantity } from "./common";

/** Lo que regresa de un rollo: cuántos metros vuelven al almacén. */
export const returnFabricLineSchema = z.object({
  lotId: cuidSchema,
  quantity: positiveQuantity,
});

export const returnFabricSchema = z.object({
  orderId: cuidSchema,
  lines: z
    .array(returnFabricLineSchema)
    .min(1, "Captura cuánto regresó de al menos un rollo"),
  notes: optionalText,
});

export type ReturnFabricInput = z.infer<typeof returnFabricSchema>;
