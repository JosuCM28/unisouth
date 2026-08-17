import { z } from "zod";
import { MeasurementSource, Unit } from "@prisma/client";
import { cuidSchema, optionalCuid, optionalNumber, optionalText, positiveQuantity } from "./common";

/** Paso 1 del wizard: de dónde viene la carga. Sólo la fecha es obligatoria. */
export const receiptHeaderSchema = z.object({
  date: z.coerce.date(),
  guideNumber: optionalText,
  carrierId: optionalCuid,
  origin: optionalText,
  supplierId: optionalCuid,
  clientId: optionalCuid,
  invoiceRef: optionalText,
  orderRef: optionalText,
  packageCount: optionalNumber,
  notes: optionalText,
});

/** Paso 2: un renglón por rollo, capturados de corrido como en una hoja. */
export const receiptLotSchema = z.object({
  materialId: cuidSchema,
  quantity: positiveQuantity,
  unit: z.nativeEnum(Unit),
  locationId: optionalCuid,
  /// Quién bajó ESTE rollo del camión. Va por rollo y no por recepción
  /// porque dos ayudantes pueden repartirse un mismo camión.
  helperId: optionalCuid,
  shade: optionalText,
  supplierLotNumber: optionalText,
  colorText: optionalText,
  actualWidthMm: optionalNumber,
  measurementSource: z.nativeEnum(MeasurementSource).default(MeasurementSource.SUPPLIER_LABEL),
  comment: optionalText,
});

export const receiptSchema = receiptHeaderSchema.extend({
  lots: z.array(receiptLotSchema).min(1, "Captura al menos un rollo"),
});

export type ReceiptInput = z.infer<typeof receiptSchema>;
export type ReceiptLotInput = z.infer<typeof receiptLotSchema>;
