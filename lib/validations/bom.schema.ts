import { z } from "zod";
import { BomStatus, Unit } from "@prisma/client";
import { cuidSchema, optionalCuid, optionalText, percentage } from "./common";

/** Un renglón de la receta: qué material y cuánto por pieza. */
export const bomLineSchema = z.object({
  materialId: cuidSchema,
  consumptionPerUnit: z.coerce
    .number({ message: "Escribe el consumo por pieza" })
    .positive("El consumo debe ser mayor que cero"),
  unit: z.nativeEnum(Unit, { message: "Elige la unidad" }),
  wastePct: percentage.optional().default(0),
  sizeId: optionalCuid,
  /** Cantidad fija por corrida, no por pieza (un trazo de papel). */
  isFixedQuantity: z.boolean().default(false),
  optional: z.boolean().default(false),
  part: optionalText,
  notes: optionalText,
});

export type BomLineInput = z.infer<typeof bomLineSchema>;

export const bomSchema = z.object({
  productId: cuidSchema,
  name: optionalText,
  status: z.nativeEnum(BomStatus).default(BomStatus.DRAFT),
  /** Merma del proceso (tendido, puntas, trazo). Se aplica SOBRE la de línea. */
  globalWastePct: percentage.optional().default(0),
  notes: optionalText,
  lines: z.array(bomLineSchema).min(1, "Agrega al menos un material a la ficha"),
});

export type BomInput = z.infer<typeof bomSchema>;

export const bomFormSchema = z.object({
  productId: z.string().min(1, "Elige el producto"),
  name: z.string().optional(),
  globalWastePct: z.string().optional(),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        materialId: z.string().min(1, "Elige el material"),
        consumptionPerUnit: z.string().min(1, "Escribe el consumo"),
        unit: z.nativeEnum(Unit),
        wastePct: z.string().optional(),
        sizeId: z.string().optional(),
        isFixedQuantity: z.boolean(),
        part: z.string().optional(),
      }),
    )
    .min(1, "Agrega al menos un material"),
});

export type BomFormValues = z.infer<typeof bomFormSchema>;
