import { z } from "zod";
import {
  cuidSchema,
  localDate,
  optionalCuid,
  optionalText,
  requiredText,
} from "./common";

const pieces = (label: string) =>
  z.coerce
    .number({ message: `Escribe ${label}` })
    .int("Las piezas se cuentan enteras")
    .min(0, "No puede ser negativo");

/**
 * Un renglón de la salida: una talla, las buenas y la merma.
 *
 * Una talla por renglón, a diferencia del envío: aquí no se amarran bultos,
 * se descuenta un saldo, y dos renglones de la misma talla sólo servirían
 * para equivocarse al sumar.
 */
export const workshopOutputLineSchema = z
  .object({
    sizeId: cuidSchema,
    quantity: pieces("cuántas salen"),
    scrapQuantity: pieces("la merma").default(0),
    scrapReason: optionalText,
  })
  .refine((line) => line.quantity + line.scrapQuantity > 0, {
    message: "Una talla sin piezas no se captura",
    path: ["quantity"],
  })
  /* Sin motivo, la merma es un número que nadie puede revisar: ¿fue la
     máquina, la tela, el bordado? */
  .refine((line) => line.scrapQuantity === 0 || Boolean(line.scrapReason), {
    message: "Escribe por qué se perdieron",
    path: ["scrapReason"],
  });

export const workshopOutputSchema = z.object({
  orderId: cuidSchema,
  /* Vacío = regresan a la planta. Sólo informa: nadie lo recibe. */
  destinationWorkshopId: optionalCuid,
  date: localDate.optional(),
  parts: optionalText,
  notes: optionalText,
  lines: z
    .array(workshopOutputLineSchema)
    .min(1, "Agrega al menos una talla")
    .refine(
      (lines) => new Set(lines.map((line) => line.sizeId)).size === lines.length,
      "Cada talla va una sola vez",
    ),
});

export type WorkshopOutputInput = z.infer<typeof workshopOutputSchema>;

/**
 * Un renglón de la salida a Embarques: talla + PO. La misma talla SÍ puede
 * repetirse si va a dos PO distintas (60 de la M a la 4565 y 40 a la 4570),
 * porque en Embarques son dos renglones del inventario.
 */
const finishedOutputLineSchema = z
  .object({
    sizeId: cuidSchema,
    clientPo: optionalText,
    quantity: pieces("cuántas salen"),
    scrapQuantity: pieces("la merma").default(0),
    scrapReason: optionalText,
  })
  .refine((line) => line.quantity + line.scrapQuantity > 0, {
    message: "Un renglón sin piezas no se captura",
    path: ["quantity"],
  })
  .refine((line) => line.scrapQuantity === 0 || Boolean(line.scrapReason), {
    message: "Escribe por qué se perdieron",
    path: ["scrapReason"],
  });

/** La salida de un taller de CONFECCIÓN: prenda terminada hacia Embarques. */
export const finishedOutputSchema = z.object({
  orderId: cuidSchema,
  productId: cuidSchema,
  /* El dueño en Embarques. Sale de la orden; vacío = sin cliente. */
  clientId: optionalCuid,
  date: localDate.optional(),
  notes: optionalText,
  lines: z
    .array(finishedOutputLineSchema)
    .min(1, "Agrega al menos una talla")
    .refine(
      (lines) =>
        new Set(lines.map((line) => `${line.sizeId}|${line.clientPo ?? ""}`)).size === lines.length,
      "La misma talla con la misma PO va una sola vez",
    ),
});

export type FinishedOutputInput = z.infer<typeof finishedOutputSchema>;

export const cancelWorkshopOutputSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo", 500),
});

/** Lo que pide la pantalla para prellenar la salida de una orden. */
export const workshopBalanceQuerySchema = z.object({ orderId: cuidSchema });
