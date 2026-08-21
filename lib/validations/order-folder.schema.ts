import { z } from "zod";
import { localDate, optionalCuid, optionalText, requiredText } from "./common";

/**
 * Una carpeta de pedido.
 *
 * El único campo obligatorio es el nombre, por la misma razón que en el resto
 * del sistema: si agrupar cuesta más de unos segundos, nadie agrupa y las
 * órdenes vuelven a quedar sueltas en una lista larga.
 */
export const orderFolderSchema = z.object({
  name: requiredText("El nombre", 120),
  clientId: optionalCuid,
  reference: optionalText,
  dueDate: localDate.optional(),
  notes: optionalText,
});

export type OrderFolderInput = z.infer<typeof orderFolderSchema>;
