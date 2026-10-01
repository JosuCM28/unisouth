import { z } from "zod";
import {
  cuidSchema,
  localDate,
  optionalCuid,
  optionalText,
  requiredText,
} from "./common";
import { batchLineSchema } from "./cutting-order.schema";
import { garmentShipmentLineSchema } from "./garment-shipment.schema";

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

/**
 * El envío a taller de UNA PARTE del pedido: los bultos que le tocan a uno de
 * los dos talleres en un reparto 40/60.
 *
 * A diferencia del envío global, aquí SÍ viajan los renglones: lo que sale es
 * una selección de bultos y el servidor no tiene de dónde adivinarla. Cada
 * renglón dice de qué orden salió, porque el envío nace por orden.
 */
export const folderSplitShipmentSchema = z.object({
  id: cuidSchema,
  workshopId: cuidSchema,
  stageId: cuidSchema,
  sentAt: localDate.optional(),
  parts: optionalText,
  reference: optionalText,
  lines: z
    .array(garmentShipmentLineSchema.extend({ orderId: cuidSchema }))
    .min(1, "Agrega al menos un bulto"),
});

export type FolderSplitShipmentInput = z.infer<typeof folderSplitShipmentSchema>;

/**
 * El corte GLOBAL del pedido: una sola captura que reparte bultos entre varias
 * órdenes.
 *
 * Reusa el esquema de las líneas del corte de una orden para que las reglas de
 * cantidad, bultos y foleo sean LAS MISMAS en las dos pantallas. Sólo viajan
 * las órdenes que de verdad llevan piezas: una orden en blanco no dice nada.
 */
export const folderCutSchema = z.object({
  folderId: cuidSchema,
  /* El corte global que se está corrigiendo. Vacío = se abre uno nuevo. Es lo
     que identifica QUÉ cortes de cada orden se capturaron juntos. */
  groupId: z.string().min(1).optional(),
  /* El nombre que llevará el corte en CADA orden. Es lo que permite reconocer
     después que dos cortes salieron de la misma mesa. */
  label: optionalText,
  notes: optionalText,
  /* Los bultos tal como se teclearon, ANTES de repartirlos. Se guardan aparte
     porque el reparto parte bultos entre órdenes y, sin esto, el bulto físico
     se pierde: el reparto 40/60 y la corrección del corte sólo verían pedazos.
     Opcional para no tumbar una captura hecha con la pantalla anterior. */
  captured: z
    .array(
      z.object({
        sizeCode: z.string().trim().min(1).max(40),
        quantity: z.coerce.number().int().positive(),
        bundles: z.coerce.number().int().positive().default(1),
        tagId: optionalCuid,
      }),
    )
    .default([]),
  orders: z
    .array(
      z
        .object({
          orderId: cuidSchema,
          /* El corte que esa orden ya tiene dentro del grupo, al corregir. */
          batchId: optionalCuid,
          lines: z
            .array(batchLineSchema)
            .transform((lines) => lines.filter((line) => line.quantity !== 0)),
        })
        /* Sin corte previo, una orden sin piezas no dice nada. Con él sí: es
           una orden que dejó de recibir piezas al corregir el reparto y su
           corte tiene que quedar vacío. */
        .refine(
          (entry) => Boolean(entry.batchId) || entry.lines.length > 0,
          "Captura piezas de al menos una talla",
        ),
    )
    .min(1, "Captura piezas de al menos una orden"),
});

export type FolderCutInput = z.infer<typeof folderCutSchema>;
