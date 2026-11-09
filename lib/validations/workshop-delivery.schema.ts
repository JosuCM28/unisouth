import { z } from "zod";
import { cuidSchema, optionalText } from "./common";

/**
 * Confirmar que la entrega llegó. El taller lo decide el rol, no el cliente.
 * La nota es opcional: la mayoría llega bien y no hay nada que decir.
 */
export const confirmWorkshopDeliverySchema = z.object({
  id: cuidSchema,
  notes: optionalText,
});
