import { z } from "zod";
import {
  cuidSchema,
  localDate,
  optionalCuid,
  optionalText,
  requiredText,
} from "./common";

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

/**
 * La salida global del pedido: un solo vale con lo cortado de todas sus
 * órdenes.
 *
 * Sólo lleva el id. QUÉ viaja no se teclea ni se manda desde el navegador: lo
 * decide el servidor leyendo los cortes del pedido. Si el cliente pudiera
 * mandar los renglones, un vale podría salir con piezas que nadie cortó.
 */
export const folderIssueSchema = z.object({ id: cuidSchema });

/**
 * El envío global a taller: taller, proceso y fecha una vez para todo el
 * pedido.
 *
 * Tampoco lleva renglones, por lo mismo: las tallas y los bultos salen de lo
 * que está capturado en cada orden. Lo que sí se elige es a dónde va y qué
 * partes de la prenda viajan, que es lo que nadie puede adivinar.
 */
export const folderWorkshopSchema = z.object({
  id: cuidSchema,
  workshopId: cuidSchema,
  stageId: cuidSchema,
  sentAt: localDate.optional(),
  dueDate: localDate.optional(),
  parts: optionalText,
  reference: optionalText,
  notes: optionalText,
});

export type FolderWorkshopInput = z.infer<typeof folderWorkshopSchema>;
