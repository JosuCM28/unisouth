import { z } from "zod";
import {
  cuidSchema,
  localDate,
  optionalText,
  requiredText,
} from "./common";

/**
 * Un renglón del envío: una talla, cuántas piezas lleva CADA bulto y cuántos
 * bultos van con esa cuenta.
 *
 * La talla se puede repetir entre renglones a propósito: de la 43 salen un
 * bulto de 30 y otro de 20, y eso son dos renglones porque el bulto no lleva
 * la misma cantidad. Es la misma forma que la tabla de corte del vale, para
 * que el desglose viaje tal cual al papel que firma el taller.
 */
export const garmentShipmentLineSchema = z.object({
  sizeId: cuidSchema,
  sentQuantity: z.coerce
    .number({ message: "Escribe cuántas piezas van" })
    .int("Las piezas se cuentan enteras")
    .positive("Deben ser más de cero"),
  /* Al menos un bulto: un renglón de cero bultos no manda nada y sólo
     conseguiría que el total del vale no cuadre con lo que sube al camión. */
  bundles: z.coerce
    .number({ message: "Escribe cuántos bultos van" })
    .int("Los bultos se cuentan enteros")
    .positive("Al menos un bulto")
    .default(1),
  notes: optionalText,
});

export const garmentShipmentSchema = z.object({
  orderId: cuidSchema,
  workshopId: cuidSchema,
  stageId: cuidSchema,
  sentAt: localDate.optional(),
  dueDate: localDate.optional(),
  /* Qué partes de la prenda van: "tapas y delantero izquierdo". Opcional
     porque lo habitual es escribirlo en las notas del vale, y pedirlo dos
     veces sólo consigue que una de las dos quede mal. */
  parts: optionalText,
  reference: optionalText,
  notes: optionalText,
  lines: z
    .array(garmentShipmentLineSchema)
    .min(1, "Agrega al menos una talla"),
});

export type GarmentShipmentInput = z.infer<typeof garmentShipmentSchema>;

/**
 * Lo que regresó del taller, para una talla.
 *
 * `quantity` puede ser NEGATIVA a propósito: así se corrige un conteo de más
 * sin borrar el registro anterior, igual que un avance de corte o un ajuste
 * del kárdex. Lo que no se acepta es un renglón que no dice nada: o regresaron
 * piezas o se reporta merma.
 */
export const garmentReturnSchema = z
  .object({
    lineId: cuidSchema,
    quantity: z.coerce
      .number({ message: "Escribe cuántas piezas regresaron" })
      .int("Las piezas se cuentan enteras")
      .default(0),
    /* La merma NO es negativa ni se resta de lo que volvió: son piezas que el
       taller perdió o echó a perder y que jamás van a regresar. Contarlas
       aparte es lo único que permite cerrar el envío sabiendo qué pasó. */
    scrapQuantity: z.coerce
      .number({ message: "Escribe cuántas se perdieron" })
      .int("Las piezas se cuentan enteras")
      .min(0, "La merma no puede ser negativa")
      .default(0),
    notes: optionalText,
  })
  .refine(
    (value) => value.quantity !== 0 || value.scrapQuantity > 0,
    "Captura cuántas regresaron o cuántas se perdieron",
  );

export type GarmentReturnInput = z.infer<typeof garmentReturnSchema>;

/* Sin motivo obligatorio: se borra lo que se capturó por error, y exigir
   una justificación por cada dedazo consigue que nadie corrija nada. Lo que
   se llevó queda en la auditoría de todos modos. */
export const removeGarmentShipmentSchema = z.object({ id: cuidSchema });

export const cancelGarmentShipmentSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo", 500),
});

/** Catálogo de talleres externos. Igual de flojo que el resto: sólo nombre. */
export const workshopSchema = z.object({
  name: requiredText("El nombre", 120),
  code: optionalText,
  contact: optionalText,
  phone: optionalText,
  address: optionalText,
  notes: optionalText,
});

export type WorkshopInput = z.infer<typeof workshopSchema>;

/** Catálogo de etapas: bordado, armado, lavado. */
export const processStageSchema = z.object({
  code: requiredText("El código", 20),
  name: requiredText("El nombre", 60),
  position: z.coerce.number().int().min(0).default(0),
});

export type ProcessStageInput = z.infer<typeof processStageSchema>;
