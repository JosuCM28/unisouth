import { z } from "zod";
import { DocumentType, Unit } from "@prisma/client";
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
});

export type DocumentInput = z.infer<typeof documentSchema>;

/** Cancelar SIEMPRE exige motivo: genera movimientos inversos y se audita CRITICAL. */
export const cancelDocumentSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo", 500),
});
