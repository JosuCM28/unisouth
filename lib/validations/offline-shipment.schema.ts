import { z } from "zod";
import { garmentShipmentSchema } from "./garment-shipment.schema";

/**
 * Un envío a taller capturado sin internet. Envuelve al mismo esquema del
 * envío en línea por la misma razón que el corte: es el mismo envío, tarde.
 */
export const offlineShipmentSchema = z.object({
  offlineId: z.string().uuid("Identificador de captura inválido"),
  shipment: garmentShipmentSchema,
});

export type OfflineShipmentInput = z.infer<typeof offlineShipmentSchema>;
