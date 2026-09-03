import { z } from "zod";
import { CutVersion } from "@prisma/client";
import {
  cuidSchema,
  localDate,
  optionalCuid,
  optionalText,
  requiredText,
} from "./common";

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
  /* De qué corte salieron. Obligatorio: un avance suelto es justo el número
     sin rastro que los cortes vienen a quitar. */
  batchId: cuidSchema,
  quantity: z.coerce
    .number({ message: "Escribe cuántas piezas se cortaron" })
    .int("Las piezas se cuentan enteras")
    .refine((value) => value !== 0, "El avance no puede ser cero"),
  notes: optionalText,
});

export type CuttingProgressInput = z.infer<typeof cuttingProgressSchema>;

/**
 * Abre un corte de una orden.
 *
 * El número NO se captura: lo pone el servidor correlativo dentro de la orden.
 * Dejarlo teclear invita a que dos personas abran el "3er corte" a la vez.
 */
export const cuttingBatchSchema = z.object({
  orderId: cuidSchema,
  label: optionalText,
  notes: optionalText,
});

export type CuttingBatchInput = z.infer<typeof cuttingBatchSchema>;

/**
 * La captura de una tanda completa: un corte y varias tallas de golpe.
 *
 * Es el flujo real del piso —se tiende, se corta de cada talla y se anota todo
 * junto—, y hacerlo en una sola transacción evita que media captura quede
 * guardada si se cae el WiFi a la mitad.
 *
 * Un renglón es UN BULTO, o varios bultos con la misma cuenta: la cantidad va
 * por bulto y `bundles` dice cuántos amarraron así. La talla SE PUEDE repetir
 * entre renglones porque en la mesa es lo normal —de la 43 sale un bulto de 30
 * y otro de 20— y promediarlos para meterlos en un solo número es justo lo que
 * la hoja de papel nunca pidió.
 *
 * Los renglones en cero se descartan ANTES de validar: se capturan a mano y un
 * renglón que se agregó y se dejó vacío no dice nada.
 */
export const batchProgressSchema = z.object({
  orderId: cuidSchema,
  /* El corte al que va la tanda. Si viene vacío se abre uno nuevo EN LA MISMA
     transacción que la captura: hacerlo en dos llamadas dejaría un corte vacío
     colgando cada vez que la captura fallara. */
  batchId: optionalCuid,
  newBatchLabel: optionalText,
  notes: optionalText,
  lines: z
    .array(
      z.object({
        lineId: cuidSchema,
        /* Puede ser NEGATIVA: así se corrige un conteo de más sin borrar lo
           capturado antes, igual que un ajuste del kárdex. */
        quantity: z.coerce
          .number({ message: "Escribe cuántas piezas se cortaron" })
          .int("Las piezas se cuentan enteras"),
        bundles: z.coerce
          .number({ message: "Escribe cuántos bultos son" })
          .int("Los bultos se cuentan enteros")
          .positive("Al menos un bulto")
          .default(1),
      }),
    )
    .transform((lines) => lines.filter((line) => line.quantity !== 0))
    .refine(
      (lines) => lines.length > 0,
      "Captura cuántas piezas salieron de al menos una talla",
    ),
});

export type BatchProgressInput = z.infer<typeof batchProgressSchema>;

/**
 * Un comentario INTERNO de la orden.
 *
 * Sin campos opcionales: un comentario vacío no es un comentario. El tope de
 * 2 000 caracteres es generoso a propósito —aquí se planea, no se llena una
 * ficha— pero existe para que un pegado accidental no meta media hoja de
 * cálculo en la base.
 */
export const orderCommentSchema = z.object({
  orderId: cuidSchema,
  body: requiredText("Escribe el comentario", 2000),
});

export type OrderCommentInput = z.infer<typeof orderCommentSchema>;
