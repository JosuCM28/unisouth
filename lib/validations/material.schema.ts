import { z } from "zod";
import { MaterialType, Unit } from "@prisma/client";
import {
  nonNegativeQuantity,
  optionalNumber,
  optionalText,
  requiredText,
} from "./common";

const materialCode = z
  .string()
  .trim()
  .min(1, "El código es obligatorio")
  .max(40, "El código no puede pasar de 40 caracteres")
  .transform((value) => value.toUpperCase().replace(/\s+/g, ""));

export const materialSchema = z
  .object({
    // Sólo estos cuatro son obligatorios: si dar de alta un material toma
    // más de 20 segundos, el auxiliar vuelve a la libreta.
    code: materialCode,
    name: requiredText("El nombre", 160),
    type: z.nativeEnum(MaterialType, { message: "Elige el tipo de material" }),
    baseUnit: z.nativeEnum(Unit, { message: "Elige la unidad base" }),

    subtype: optionalText,
    description: optionalText,

    purchaseUnit: z.nativeEnum(Unit).optional(),
    purchaseFactor: optionalNumber,

    // ── Atributos de tela ──
    composition: optionalText,
    colorName: optionalText,
    colorHex: optionalText,
    widthMm: optionalNumber,
    /// Tela plana y técnica se especifica en milímetros…
    thicknessMm: optionalNumber,
    /// …y la MEZCLILLA en onzas (oz/yd²). Ambos campos conviven: en la
    /// interfaz se muestra el que esté lleno.
    weightOz: optionalNumber,
    gsm: optionalNumber,
    shrinkagePct: optionalNumber,
    finish: optionalText,

    minStock: nonNegativeQuantity.optional().default(0),
    reorderPoint: nonNegativeQuantity.optional().default(0),
    remnantThreshold: optionalNumber,
    requiresShade: z.boolean().default(false),
    lotControlled: z.boolean().default(true),

    lastCost: optionalNumber,
    costCurrency: z.string().default("MXN"),
    active: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // Si se compra en una unidad distinta a la de almacén (rollos que se
      // guardan en metros), hace falta el factor o no se puede convertir.
      if (!data.purchaseUnit || data.purchaseUnit === data.baseUnit) return true;
      return data.purchaseFactor !== undefined && data.purchaseFactor > 0;
    },
    {
      message:
        "Si la unidad de compra es distinta a la base, indica cuántas unidades base trae cada una",
      path: ["purchaseFactor"],
    },
  );

export type MaterialInput = z.infer<typeof materialSchema>;

/**
 * Esquema del FORMULARIO: todo texto.
 *
 * Igual que en ubicaciones, los números viven como string en el formulario
 * porque un `<input>` siempre entrega string. La conversión ocurre en el
 * servidor con materialSchema, que es donde importa.
 */
export const materialFormSchema = z.object({
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
  type: z.nativeEnum(MaterialType),
  baseUnit: z.nativeEnum(Unit),

  composition: z.string().optional(),
  colorName: z.string().optional(),
  widthMm: z.string().optional(),
  thicknessMm: z.string().optional(),
  weightOz: z.string().optional(),
  gsm: z.string().optional(),
  shrinkagePct: z.string().optional(),

  minStock: z.string().optional(),
  reorderPoint: z.string().optional(),
  remnantThreshold: z.string().optional(),
  requiresShade: z.boolean(),

  purchaseUnit: z.string().optional(),
  purchaseFactor: z.string().optional(),

  active: z.boolean(),
});

export type MaterialFormValues = z.infer<typeof materialFormSchema>;
