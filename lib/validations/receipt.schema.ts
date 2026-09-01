import { z } from "zod";
import { MeasurementSource, Unit } from "@prisma/client";
import { cuidSchema, optionalCuid, optionalNumber, optionalText, positiveQuantity, localDate } from "./common";

/**
 * Paso 1 del wizard: de dónde viene la carga. Sólo la fecha es obligatoria.
 *
 * `clientId` sigue aquí para PODER CORREGIRLO después, no para capturarlo: el
 * dueño se elige rollo por rollo porque una misma guía puede traer tela de dos
 * clientes. Al dar de alta, este campo se DERIVA de los rollos.
 */
export const receiptHeaderSchema = z.object({
  date: localDate,
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
  /// De qué CLIENTE es esta tela. Va por rollo y no por recepción porque una
  /// misma guía puede traer tela de dos clientes, y la regla que no se rompe
  /// es que jamás se surte material de uno a la producción de otro. Vacío =
  /// de la fábrica.
  clientId: optionalCuid,
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

/**
 * Edición del encabezado de una recepción YA guardada.
 *
 * Se reusa `receiptHeaderSchema` para que el alta y la corrección validen con
 * las mismas reglas: si mañana la guía se vuelve obligatoria, se vuelve
 * obligatoria en los dos lados sin que nadie se acuerde de tocar el otro.
 *
 * Los rollos NO viajan aquí: esta pantalla corrige los datos de la carga
 * —guía, paquetería, origen, factura, bultos—, no el material recibido.
 */
export const updateReceiptSchema = receiptHeaderSchema.extend({
  id: cuidSchema,
  /// Obligatorio cuando cambia el dueño: reasignar material de un cliente a
  /// otro es de las correcciones que alguien va a tener que justificar.
  reason: optionalText,
});

export const receiptSchema = receiptHeaderSchema.extend({
  lots: z.array(receiptLotSchema).min(1, "Captura al menos un rollo"),
});

export type ReceiptInput = z.infer<typeof receiptSchema>;
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>;
export type ReceiptLotInput = z.infer<typeof receiptLotSchema>;
