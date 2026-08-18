import { z } from "zod";
import { ProductionRunStatus } from "@prisma/client";
import { cuidSchema, optionalText, requiredText, localDate } from "./common";

/**
 * Producción (ProductionRun): la corrida a la que se surte material.
 *
 * El cliente SÍ es obligatorio aquí, a diferencia de otros catálogos: una
 * producción sin dueño no permitiría segregar el material y se podría surtir
 * tela de un cliente a la producción de otro.
 */
export const productionRunSchema = z.object({
  // Los espacios se vuelven guiones, no se borran: "PO OVEROL 01" debe
  // quedar "PO-OVEROL-01" y no "POOVEROL01", que es ilegible en una etiqueta.
  code: requiredText("El código", 40).transform((value) =>
    value.toUpperCase().replace(/\s+/g, "-"),
  ),
  name: requiredText("El nombre", 160),
  clientId: cuidSchema,

  season: optionalText,
  startDate: localDate.optional(),
  endDate: localDate.optional(),
  status: z.nativeEnum(ProductionRunStatus).default(ProductionRunStatus.ACTIVE),
  notes: optionalText,
});

export type ProductionRunInput = z.infer<typeof productionRunSchema>;

export const productionRunFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "El código es obligatorio")
    .max(40, "El código no puede pasar de 40 caracteres"),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(160, "El nombre no puede pasar de 160 caracteres"),
  clientId: z.string().min(1, "Elige el cliente dueño del material"),

  season: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.nativeEnum(ProductionRunStatus),
  notes: z.string().optional(),
});

export type ProductionRunFormValues = z.infer<typeof productionRunFormSchema>;
