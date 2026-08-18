import { z } from "zod";
import { CutTag, DocumentType, Unit } from "@prisma/client";
import { cuidSchema, optionalCuid, optionalText, positiveQuantity, requiredText } from "./common";

export const documentLineSchema = z.object({
  lotId: cuidSchema,
  quantity: positiveQuantity,
  unit: z.nativeEnum(Unit),
  fromLocationId: optionalCuid,
  toLocationId: optionalCuid,
  notes: optionalText,
});

export type DocumentLineInput = z.infer<typeof documentLineSchema>;

/**
 * Un renglón de la tabla de corte: cuántas prendas de una talla salen.
 *
 * Es OTRA cosa que `documentLineSchema`, que habla de rollos y metros. Aquí
 * se cuentan prendas y bultos, que es lo que firma el taller.
 */
export const documentCutLineSchema = z.object({
  sizeId: cuidSchema,
  quantity: z.coerce
    .number({ message: "Escribe cuántas prendas" })
    .int("Las prendas se cuentan enteras")
    .positive("Deben ser más de cero"),
  /// Al menos un bulto: un renglón sin bulto no existe físicamente.
  bundles: z.coerce
    .number({ message: "Escribe cuántos bultos" })
    .int("Los bultos se cuentan enteros")
    .positive("Debe ser al menos un bulto")
    .default(1),
  tag: z.nativeEnum(CutTag).optional(),
  notes: optionalText,
});

export type DocumentCutLineInput = z.infer<typeof documentCutLineSchema>;

export const documentSchema = z.object({
  type: z.nativeEnum(DocumentType, { message: "Elige el tipo de documento" }),
  date: z.coerce.date().optional(),
  clientId: optionalCuid,
  productionRunId: optionalCuid,
  concept: optionalText,
  reference: optionalText,
  /** Quién entrega y quién recibe: el vale se firma en físico. */
  handedOverBy: optionalText,
  receivedBy: optionalText,
  notes: optionalText,
  lines: z.array(documentLineSchema).min(1, "Agrega al menos un renglón"),
  /**
   * La tabla de corte es OPCIONAL: una salida de insumos —cierres, hilo— no
   * corta prendas y no tiene por qué llenarla. Sólo las salidas de tela hacia
   * el taller la traen.
   */
  cutLines: z.array(documentCutLineSchema).optional(),
});

export type DocumentInput = z.infer<typeof documentSchema>;

/** Cancelar SIEMPRE exige motivo: genera movimientos inversos y se audita CRITICAL. */
export const cancelDocumentSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo", 500),
});
