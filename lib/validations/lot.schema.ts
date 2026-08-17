import { z } from "zod";
import { LotStatus, MeasurementSource, Unit } from "@prisma/client";
import {
  cuidSchema,
  optionalCuid,
  optionalNumber,
  optionalText,
  positiveQuantity,
  requiredText,
} from "./common";

/**
 * Alta de rollo: SÓLO material, cantidad y unidad son obligatorios.
 *
 * Todo lo demás es opcional a propósito. El auxiliar da de alta el rollo con
 * la carga todavía en el andén; si el formulario le exige tono, proveedor y
 * ubicación antes de guardar, no lo usa.
 */
export const createLotSchema = z.object({
  materialId: cuidSchema,
  quantity: positiveQuantity,
  unit: z.nativeEnum(Unit, { message: "Elige la unidad" }),

  // ── Todo lo de aquí abajo es opcional ──
  clientId: optionalCuid,
  locationId: optionalCuid,
  receiptId: optionalCuid,
  productionRunId: optionalCuid,

  supplierLotNumber: optionalText,
  /// Partida de tintura. Distinta del lote del proveedor: dos tonos en un
  /// mismo tendido salen con franjas y la prenda se rechaza.
  shade: optionalText,
  colorText: optionalText,

  actualWidthMm: optionalNumber,
  actualThicknessMm: optionalNumber,
  actualWeightOz: optionalNumber,
  weightKg: optionalNumber,

  measurementSource: z
    .nativeEnum(MeasurementSource)
    .default(MeasurementSource.SUPPLIER_LABEL),
  verified: z.boolean().default(false),

  unitCost: optionalNumber,
  currency: z.string().default("MXN"),
  receivedAt: z.coerce.date().optional(),
  comment: optionalText,
});

export type CreateLotInput = z.infer<typeof createLotSchema>;

/**
 * Corte de rollo: se toma un tramo y se surte.
 *
 * Debe lograrse en 2 toques desde la ficha, así que sólo pide la cantidad.
 */
export const cutLotSchema = z.object({
  lotId: cuidSchema,
  quantity: positiveQuantity,
  productionRunId: optionalCuid,
  toLocationId: optionalCuid,
  reason: optionalText,
});

export type CutLotInput = z.infer<typeof cutLotSchema>;

/**
 * Reconteo: lo que de verdad hay contra lo que dice el sistema.
 *
 * `countedQuantity` puede ser 0 —un rollo que ya no está—, así que no usa
 * positiveQuantity. El motivo es obligatorio: un ajuste sin explicación es
 * inútil seis meses después, cuando alguien pregunte por qué faltan 40 metros.
 */
export const recountLotSchema = z.object({
  lotId: cuidSchema,
  countedQuantity: z
    .union([z.string(), z.number()])
    .transform((value) =>
      typeof value === "number" ? value : Number(String(value).replace(",", ".")),
    )
    .refine((value) => Number.isFinite(value), "Escribe un número válido")
    .refine((value) => value >= 0, "La cantidad no puede ser negativa"),
  reason: requiredText("El motivo", 500),
  measurementSource: z
    .nativeEnum(MeasurementSource)
    .default(MeasurementSource.MEASURED),
});

export type RecountLotInput = z.infer<typeof recountLotSchema>;

/**
 * Traspaso entre ubicaciones. No toca el saldo: genera un movimiento
 * RECLASSIFICATION con cantidad 0.
 */
export const transferLotSchema = z.object({
  lotId: cuidSchema,
  toLocationId: cuidSchema,
  reason: optionalText,
});

export type TransferLotInput = z.infer<typeof transferLotSchema>;

/**
 * Edición de la ficha del rollo: corregir el error de dedo.
 *
 * Aquí SÓLO viven los campos descriptivos, los que alguien pudo teclear mal
 * al dar de alta el rollo. Lo que está fuera lo está a propósito:
 *
 * · `quantity` / `currentQuantity` — el saldo se escribe únicamente dentro de
 *   InventoryService junto al movimiento que lo justifica. Corregir un saldo
 *   es un reconteo, no una edición.
 * · `receivedAt` — la fecha de llegada es un hecho histórico: el material
 *   entró por la puerta ese día. Moverla desalinearía el rollo de su
 *   recepción y de los reportes que ya se imprimieron.
 * · `status` — lo gobiernan los movimientos, el reconteo y la cancelación.
 *   Editarlo a mano permitiría "descancelar" un rollo o marcarlo agotado sin
 *   un kárdex que lo respalde.
 * · `isBlocked` / `blockReason` — bloquear es una decisión operativa con su
 *   propio motivo, no un campo de captura.
 * · `code` — el folio es la identidad del rollo y está impreso en su QR.
 */
export const updateLotSchema = z.object({
  id: cuidSchema,

  clientId: optionalCuid,
  locationId: optionalCuid,
  supplierLotNumber: optionalText,
  shade: optionalText,
  colorText: optionalText,

  actualWidthMm: optionalNumber,
  actualThicknessMm: optionalNumber,
  actualWeightOz: optionalNumber,
  weightKg: optionalNumber,

  unitCost: optionalNumber,
  expiresAt: z.coerce.date().optional(),
  comment: optionalText,

  /**
   * Por qué se corrige. Opcional: la mayoría de las correcciones son un dedazo
   * evidente y exigir justificación en cada una haría que nadie corrija nada.
   * Cuando se escribe, queda en la bitácora junto al resto del cambio.
   */
  reason: optionalText,
});

export type UpdateLotInput = z.infer<typeof updateLotSchema>;

/**
 * Cancelación (baja) de un rollo.
 *
 * El motivo es OBLIGATORIO y no se puede dejar en blanco: cancelar hace
 * desaparecer material del inventario, y sin explicación nadie puede
 * reconstruir seis meses después por qué ese rollo dejó de contar. Es la
 * misma exigencia que el reconteo, por la misma razón.
 */
export const cancelLotSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo de la cancelación", 500),
});

export type CancelLotInput = z.infer<typeof cancelLotSchema>;
