import { z } from "zod";
import { Unit } from "@prisma/client";
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

/** Un rollo que se le asigna a una orden: cuánto se lleva de él. */
export const orderIssueLineSchema = z.object({
  lotId: cuidSchema,
  quantity: positiveQuantity,
  unit: z.nativeEnum(Unit),
});

/** Una orden de la salida múltiple y los rollos que le tocan. */
export const orderIssueTargetSchema = z.object({
  orderId: cuidSchema,
  lines: z
    .array(orderIssueLineSchema)
    .min(1, "Cada orden necesita al menos un rollo"),
});

/**
 * Salida de tela a VARIAS órdenes en una sola captura.
 *
 * Quien recibe y las notas son del viaje completo y se copian a cada vale:
 * es la misma persona firmando la misma entrega.
 */
export const issueToOrdersSchema = z
  .object({
    receivedBy: optionalText,
    notes: optionalText,
    orders: z
      .array(orderIssueTargetSchema)
      .min(1, "Agrega al menos una orden"),
  })
  .superRefine((input, ctx) => {
    /* La misma orden dos veces partiría su tela en dos vales sin razón: lo
       que se quiera sumar a una orden se suma en su propio bloque. */
    const seen = new Set<string>();
    input.orders.forEach((target, index) => {
      if (seen.has(target.orderId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["orders", index, "orderId"],
          message: "Esa orden ya está en la salida",
        });
      }
      seen.add(target.orderId);
    });
  });

export type IssueToOrdersInput = z.infer<typeof issueToOrdersSchema>;
