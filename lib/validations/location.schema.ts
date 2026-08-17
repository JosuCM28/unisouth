import { z } from "zod";
import { LocationType } from "@prisma/client";
import {
  optionalCuid,
  optionalNumber,
  optionalText,
  requiredText,
} from "./common";

/**
 * El código va pintado en el piso o en el rack y se teclea a mano.
 * Se normaliza a mayúsculas y sin espacios para que "f1", "F1" y "F 1"
 * no acaben siendo tres ubicaciones distintas.
 */
const locationCode = z
  .string()
  .trim()
  .min(1, "El código es obligatorio")
  .max(32, "El código no puede pasar de 32 caracteres")
  .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
  .refine(
    (value) => /^[A-Z0-9._-]+$/.test(value),
    "Sólo letras, números, punto, guion y guion bajo",
  );

export const locationSchema = z.object({
  code: locationCode,
  name: requiredText("El nombre", 120),

  type: z.nativeEnum(LocationType).default(LocationType.ROW),
  order: optionalNumber,
  lotCapacity: optionalNumber,
  parentId: optionalCuid,
  notes: optionalText,
  active: z.boolean().default(true),
});

export type LocationInput = z.infer<typeof locationSchema>;

export const updateLocationSchema = locationSchema.extend({
  id: z.string().min(1),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

/**
 * Esquema del FORMULARIO.
 *
 * Distinto del de arriba a propósito: en el formulario los números viven
 * como texto —un `<input>` siempre entrega string— y el `.transform()` del
 * esquema de servidor haría que RHF tipara los campos como `number`,
 * peleando con cada tecla. Aquí todo es string y la conversión ocurre del
 * lado del servidor, que es donde importa.
 */
export const locationFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "El código es obligatorio")
    .max(32, "El código no puede pasar de 32 caracteres")
    .refine(
      (value) => /^[A-Za-z0-9._\- ]+$/.test(value),
      "Sólo letras, números, punto, guion y guion bajo",
    ),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "El nombre no puede pasar de 120 caracteres"),

  type: z.nativeEnum(LocationType),
  order: z.string().optional(),
  lotCapacity: z.string().optional(),
  parentId: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean(),
});

export type LocationFormValues = z.infer<typeof locationFormSchema>;
