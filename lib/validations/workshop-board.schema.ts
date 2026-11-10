import { z } from "zod";
import { cuidSchema } from "./common";

/** Abrir la ficha de una entrega desde el tablero. El taller lo pone el tablero. */
export const boardDeliveryDetailSchema = z.object({
  id: cuidSchema,
});
