import { z } from "zod";
import { cuidSchema, localDate, optionalCuid, optionalText } from "./common";

/** Un renglón: una talla y cuántas piezas pidieron de ella. */
export const cuttingOrderLineSchema = z.object({
  sizeId: cuidSchema,
  orderedQuantity: z.coerce
    .number({ message: "Escribe cuántas piezas" })
    .int("Las piezas se cuentan enteras")
    .positive("Deben ser más de cero"),
  tagId: optionalCuid,
  notes: optionalText,
});

export const cuttingOrderSchema = z.object({
  clientId: optionalCuid,
  materialId: optionalCuid,
  productionRunId: optionalCuid,
  /// La carpeta de pedido a la que pertenece. Sin ella la orden queda suelta,
  /// que es un estado normal: agrupar es opcional.
  folderId: optionalCuid,
  description: optionalText,
  reference: optionalText,
  orderedAt: localDate.optional(),
  dueDate: localDate.optional(),
  notes: optionalText,
  lines: z
    .array(cuttingOrderLineSchema)
    .min(1, "Agrega al menos una talla"),
});

export type CuttingOrderInput = z.infer<typeof cuttingOrderSchema>;
export type CuttingOrderLineInput = z.infer<typeof cuttingOrderLineSchema>;

/**
 * Un avance de corte.
 *
 * La cantidad puede ser NEGATIVA a propósito: así se corrige un conteo de más
 * sin borrar el registro anterior, igual que un movimiento de ajuste en el
 * kárdex. Lo que no se acepta es un cero, que no sería un avance.
 */
export const cuttingProgressSchema = z.object({
  lineId: cuidSchema,
  quantity: z.coerce
    .number({ message: "Escribe cuántas piezas se cortaron" })
    .int("Las piezas se cuentan enteras")
    .refine((value) => value !== 0, "El avance no puede ser cero"),
  notes: optionalText,
});

export type CuttingProgressInput = z.infer<typeof cuttingProgressSchema>;
