import { z } from "zod";
import { cuidSchema } from "./common";

/** Confirmar que la entrega llegó. El taller lo decide el rol, no el cliente. */
export const confirmWorkshopDeliverySchema = z.object({ id: cuidSchema });
