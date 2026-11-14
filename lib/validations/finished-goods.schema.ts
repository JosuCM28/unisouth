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
