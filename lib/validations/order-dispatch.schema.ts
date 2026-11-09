import { z } from "zod";
import { cuidSchema } from "./common";

export const DISPATCH_KINDS = ["shipment", "voucher"] as const;

export type DispatchKind = (typeof DISPATCH_KINDS)[number];

export const orderDispatchOptionsSchema = z.object({ orderId: cuidSchema });

/** La fecha no viaja: "enviado" es hoy, y la pone el servidor. */
export const markOrderDispatchedSchema = z.object({
  orderId: cuidSchema,
  items: z
    .array(z.object({ kind: z.enum(DISPATCH_KINDS), id: cuidSchema }))
    .min(1, "Elige lo que estás enviando")
    .max(100),
});

export type MarkOrderDispatchedInput = z.infer<
  typeof markOrderDispatchedSchema
>;
