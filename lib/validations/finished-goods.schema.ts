import { z } from "zod";
import { cuidSchema, optionalCuid, optionalText, requiredText } from "./common";

/** Qué renglón del inventario: producto, talla, dueño y PO. */
export const finishedStockKeySchema = z.object({
  productId: cuidSchema,
  sizeId: cuidSchema,
  clientId: optionalCuid,
  /* Vacío = "Sin PO". En mayúsculas como todo: "po-4565" y "PO-4565" serían
     dos renglones del mismo inventario. */
  clientPo: optionalText,
});

export type FinishedStockKeyInput = z.infer<typeof finishedStockKeySchema>;

/**
 * Entrada o salida MANUAL. El motivo es obligatorio: la carga inicial de lo
 * que ya estaba en la bodega se distingue así de un faltante en un reconteo.
 */
export const adjustFinishedGoodsSchema = finishedStockKeySchema.extend({
  direction: z.enum(["IN", "OUT"]),
  quantity: z.coerce
    .number({ message: "Escribe cuántas piezas" })
    .int("Las piezas se cuentan enteras")
    .positive("Deben ser más de cero"),
  reason: requiredText("El motivo", 500),
});

export type AdjustFinishedGoodsInput = z.infer<typeof adjustFinishedGoodsSchema>;

export const finishedMovementsQuerySchema = z.object({ stockId: cuidSchema });

/**
 * Ponerle PO a piezas que llegaron "Sin PO". Se puede repartir: de 23
 * piezas, 10 a una PO y luego 13 a otra. El motivo es opcional porque es el
 * trabajo de todos los días de Embarques.
 */
export const assignFinishedPoSchema = z.object({
  stockId: cuidSchema,
  clientPo: requiredText("La PO", 60),
  quantity: z.coerce
    .number({ message: "Escribe cuántas piezas" })
    .int("Las piezas se cuentan enteras")
    .positive("Deben ser más de cero"),
  reason: optionalText,
});

/** Cambiar una PO que ya venía: sólo ADMIN y siempre con motivo (`HIGH`). */
export const changeFinishedPoSchema = assignFinishedPoSchema.extend({
  reason: requiredText("El motivo", 500),
});

export type FinishedPoMoveInput = z.infer<typeof assignFinishedPoSchema>;

/** Los filtros de la pantalla, tal como llegan en la URL. */
export interface FinishedGoodsFilters {
  categoryId?: string;
  clientId?: string;
  clientPo?: string;
  sizeId?: string;
  search?: string;
  /** Para llenar la caja de un pedido: sólo prenda de este dueño o sin dueño. */
  forClientId?: string;
}
