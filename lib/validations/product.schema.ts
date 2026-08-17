import { z } from "zod";
import { Unit } from "@prisma/client";
import { optionalCuid, optionalText, requiredText } from "./common";

/** Producto terminado: el overol, el pantalón. Lo que se produce. */
export const productSchema = z.object({
  code: requiredText("El código", 40).transform((v) =>
    v.toUpperCase().replace(/\s+/g, "-"),
  ),
  name: requiredText("El nombre", 160),
  clientId: optionalCuid,
  category: optionalText,
  unit: z.nativeEnum(Unit).default(Unit.PIECE),
  description: optionalText,
  active: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;

export const productFormSchema = z.object({
  code: z.string().trim().min(1, "El código es obligatorio").max(40),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  clientId: z.string().optional(),
  category: z.string().optional(),
  unit: z.nativeEnum(Unit),
  description: z.string().optional(),
  active: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

/**
 * Talla: escala el consumo en vez de duplicar la ficha técnica.
 * CH 0.92 · M 1.00 · G 1.08 · XG 1.16
 */
export const sizeSchema = z.object({
  code: requiredText("El código", 16).transform((v) => v.toUpperCase().trim()),
  name: requiredText("El nombre", 60),
  order: z.coerce.number().int().min(0).default(0),
  consumptionFactor: z.coerce
    .number({ message: "Escribe el factor de consumo" })
    .positive("El factor debe ser mayor que cero")
    .max(5, "Un factor arriba de 5 casi seguro es un dedazo"),
  group: optionalText,
  active: z.boolean().default(true),
});

export type SizeInput = z.infer<typeof sizeSchema>;

export const sizeFormSchema = z.object({
  code: z.string().trim().min(1, "El código es obligatorio").max(16),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  order: z.string().optional(),
  consumptionFactor: z.string().min(1, "Escribe el factor"),
  group: z.string().optional(),
  active: z.boolean(),
});

export type SizeFormValues = z.infer<typeof sizeFormSchema>;

/** Variante: SKU concreto (producto + talla + color). */
export const variantSchema = z.object({
  productId: z.string().min(1, "Elige el producto"),
  sku: requiredText("El SKU", 60).transform((v) => v.toUpperCase().trim()),
  sizeId: optionalCuid,
  color: optionalText,
  /** Sustituye al factor de talla cuando el escalado lineal no aplica. */
  consumptionFactorOverride: z.coerce.number().positive().max(5).optional(),
  active: z.boolean().default(true),
});

export type VariantInput = z.infer<typeof variantSchema>;
