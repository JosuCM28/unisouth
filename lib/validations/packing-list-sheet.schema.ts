import { z } from "zod";
import { cuidSchema, localDate, numericString, optionalText, requiredText } from "./common";

/** Topes para que un packing list pegado por error no tumbe el servidor. */
export const PACKING_LIST_MAX_LINES = 500;
export const PACKING_LIST_MAX_BOXES = 300;

/**
 * Entero opcional desde un input: `""` es "sin dato", no cero. La caja en
 * blanco es la forma en que el papel dice "sigue la misma caja".
 */
const optionalInt = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => (value === undefined || String(value).trim() === "" ? undefined : Number(value)))
  .refine((value) => value === undefined || (Number.isInteger(value) && value > 0), "La caja es un número entero");

/** Peso en kg, opcional y con coma o punto decimal. */
const optionalWeight = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => (value === undefined || String(value).trim() === "" ? undefined : value))
  .pipe(numericString.refine((value) => value >= 0, "El peso no puede ser negativo").optional());

export const packingListLineSchema = z.object({
  /* De qué renglón del inventario salió; sólo para volver a llenar. */
  stockId: z.string().max(40).optional().nullable().transform((value) => value || undefined),
  orderRef: optionalText,
  destination: optionalText,
  description: requiredText("La descripción", 200),
  color: optionalText,
  boxNumber: optionalInt,
  size: optionalText,
  quantity: z.coerce
    .number({ message: "Escribe la cantidad" })
    .int("Las piezas se cuentan enteras")
    .min(0, "La cantidad no puede ser negativa"),
});

export const packingListBoxSchema = z.object({
  boxNumber: z.coerce.number().int().positive(),
  weightKg: optionalWeight,
  dimensions: optionalText,
});

/**
 * El packing list editado. Pocos obligatorios, como todo formulario de la
 * casa: el cliente, la fecha y que cada renglón diga qué es. Lo demás —color,
 * destino, firmas— se llena cuando se sabe.
 */
export const packingListSheetSchema = z.object({
  orderId: cuidSchema,
  formatCode: requiredText("El código del formato", 40),
  revision: requiredText("La revisión", 60),
  client: requiredText("El cliente", 160),
  date: localDate,
  preparedBy: optionalText,
  reviewedBy: optionalText,
  receivedBy: optionalText,
  notes: optionalText,
  lines: z
    .array(packingListLineSchema)
    .min(1, "El packing list necesita al menos un renglón")
    .max(PACKING_LIST_MAX_LINES, `No más de ${PACKING_LIST_MAX_LINES} renglones`),
  boxes: z.array(packingListBoxSchema).max(PACKING_LIST_MAX_BOXES),
});

export type PackingListSheetInput = z.infer<typeof packingListSheetSchema>;
export type PackingListLineInput = z.infer<typeof packingListLineSchema>;
export type PackingListBoxInput = z.infer<typeof packingListBoxSchema>;
