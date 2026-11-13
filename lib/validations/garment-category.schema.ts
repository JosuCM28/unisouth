import { z } from "zod";
import { requiredText } from "./common";

/** Tipo de prenda: Camisa, Pantalón, Overol. */
export const garmentCategorySchema = z.object({
  name: requiredText("El nombre", 60),
  /** Sólo acomoda filtros y packing list; no es una secuencia obligatoria. */
  position: z.coerce.number().int().min(0).default(0),
});

export type GarmentCategoryInput = z.infer<typeof garmentCategorySchema>;

export const garmentCategoryFormSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre").max(60),
  position: z.string().optional(),
});

export type GarmentCategoryFormValues = z.infer<typeof garmentCategoryFormSchema>;
