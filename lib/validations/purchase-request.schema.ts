import { z } from "zod";
import { Unit } from "@prisma/client";
import { cuidSchema, optionalCuid, optionalText, positiveQuantity, requiredText, localDate } from "./common";

export const purchaseRequestLineSchema = z.object({
  materialId: cuidSchema,
  quantity: positiveQuantity,
  unit: z.nativeEnum(Unit),
  notes: optionalText,
});

export const purchaseRequestSchema = z.object({
  clientId: optionalCuid,
  calculationId: optionalCuid,
  neededByDate: localDate.optional(),
  justification: optionalText,
  notes: optionalText,
  lines: z.array(purchaseRequestLineSchema).min(1, "Agrega al menos un material"),
});

export type PurchaseRequestInput = z.infer<typeof purchaseRequestSchema>;

/** Rechazar exige motivo; aprobar no. */
export const purchaseDecisionSchema = z.object({
  id: cuidSchema,
  reason: optionalText,
});

export const rejectPurchaseSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo del rechazo", 500),
});
