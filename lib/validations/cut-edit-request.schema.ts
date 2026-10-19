import { z } from "zod";
import { cuidSchema, optionalText, requiredText } from "./common";

/**
 * Pedir permiso para corregir una orden terminada.
 *
 * El motivo es obligatorio porque es lo único que ADMIN tiene para decidir:
 * "me equivoqué en la 34, son 60 y no 66" se autoriza; un permiso sin
 * explicación es firmar en blanco.
 */
export const cutEditRequestSchema = z.object({
  orderId: cuidSchema,
  reason: requiredText("El motivo", 500),
});

export type CutEditRequestInput = z.infer<typeof cutEditRequestSchema>;

/** Autorizar o rechazar. La nota es opcional al autorizar y al rechazar. */
export const cutEditReviewSchema = z.object({
  id: cuidSchema,
  approve: z.boolean(),
  note: optionalText,
});

export type CutEditReviewInput = z.infer<typeof cutEditReviewSchema>;
