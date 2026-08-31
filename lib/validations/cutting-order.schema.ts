import { z } from "zod";
import { CutVersion } from "@prisma/client";
import { cuidSchema, localDate, optionalCuid, optionalText } from "./common";

/** Un renglón: una talla y cuántas piezas pidieron de ella. */
export const cuttingOrderLineSchema = z.object({
  /* Sólo viene en un renglón que YA existe en la base. Ahora que una talla se
     puede repetir en varios renglones, `sizeId` dejó de identificar cuál es
     cuál: sin este id, dos renglones de la 38 se confundirían al corregir la
     orden y uno se pisaría con los datos del otro. */
  id: optionalCuid,
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

  /* El encabezado del corte, el mismo que imprime el vale de salida.
     `description` y `materialId` de arriba ya son la prenda y la tela: aquí
     sólo van los campos que faltaban para no recapturarlos en la salida. */
  cutFabricText: optionalText,
  cutPattern: optionalText,
  cutVersion: z
    .union([z.nativeEnum(CutVersion), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  cutVersionNotes: optionalText,
  /* Los renglones vacíos se tiran aquí y no en el componente: una nota en
     blanco saldría impresa como "3." sin texto, y en el taller eso se lee
     como una instrucción que se borró. */
  cutNotes: z
    .array(z.string())
    .optional()
    .transform((values) =>
      (values ?? []).map((note) => note.trim()).filter((note) => note.length > 0),
    ),
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
