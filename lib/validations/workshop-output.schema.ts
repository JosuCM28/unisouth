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

export const cancelWorkshopOutputSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo", 500),
});

/** Lo que pide la pantalla para prellenar la salida de una orden. */
export const workshopBalanceQuerySchema = z.object({ orderId: cuidSchema });
