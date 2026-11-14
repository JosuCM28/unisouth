import { z } from "zod";
import {
  cuidSchema,
  localDate,
  optionalCuid,
  optionalText,
  requiredText,
} from "./common";

/** El pedido: sólo el nombre es obligatorio, como lo escribe quien empaca. */
export const packingOrderSchema = z.object({
  name: requiredText("El nombre", 120),
  /* Con cliente, sus cajas sólo aceptan prenda de ese dueño. */
  clientId: optionalCuid,
  date: localDate.optional(),
  notes: optionalText,
});

export type PackingOrderInput = z.infer<typeof packingOrderSchema>;

export const packingOrderIdSchema = z.object({ id: cuidSchema });

export const reopenPackingOrderSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo", 500),
});

export const packingBoxIdSchema = z.object({ boxId: cuidSchema });

/** Meter o sacar piezas de un renglón del inventario en una caja. */
export const packingMoveSchema = z.object({
  boxId: cuidSchema,
  stockId: cuidSchema,
  quantity: z.coerce
    .number({ message: "Escribe cuántas piezas" })
    .int("Las piezas se cuentan enteras")
    .positive("Deben ser más de cero"),
});

export type PackingMoveInput = z.infer<typeof packingMoveSchema>;
