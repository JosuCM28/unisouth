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
 * Edición de la ficha del rollo.
 *
 * Nota que NO incluye `quantity`: el saldo se escribe únicamente dentro de
 * InventoryService, junto al movimiento que lo justifica. Corregir un saldo
 * es un reconteo, no una edición.
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

  status: z.nativeEnum(LotStatus).optional(),
  isBlocked: z.boolean().optional(),
  blockReason: optionalText,

  unitCost: optionalNumber,
  expiresAt: z.coerce.date().optional(),
  comment: optionalText,
});

export type UpdateLotInput = z.infer<typeof updateLotSchema>;
