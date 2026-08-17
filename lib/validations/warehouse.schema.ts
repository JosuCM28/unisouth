import { z } from "zod";
import { optionalText, requiredText } from "./common";

/**
 * El código identifica al almacén en folios y reportes.
 *
 * Se normaliza igual que el de ubicación: mayúsculas y sin espacios, para que
 * "bodega", "BODEGA" y "Bo dega" no acaben siendo tres almacenes distintos.
 */
const warehouseCode = z
  .string()
  .trim()
  .min(1, "El código es obligatorio")
  .max(32, "El código no puede pasar de 32 caracteres")
  .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
  .refine(
    (value) => /^[A-Z0-9._-]+$/.test(value),
    "Sólo letras, números, punto, guion y guion bajo",
  );

export const warehouseSchema = z.object({
  code: warehouseCode,
  name: requiredText("El nombre", 120),
  address: optionalText,
  notes: optionalText,
  /**
   * El almacén donde caen los rollos que no dicen a cuál van.
   *
   * Sólo uno puede tenerlo: el servicio se encarga de quitárselo al anterior
   * al marcar uno nuevo.
   */
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
});

export type WarehouseInput = z.infer<typeof warehouseSchema>;

export const updateWarehouseSchema = warehouseSchema.extend({
  id: z.string().min(1),
});

export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;

/**
 * Esquema del FORMULARIO.
 *
 * Igual que en ubicaciones: aquí todo es texto porque un `<input>` entrega
 * texto, y el `.transform()` del esquema de servidor haría que RHF tipara los
 * campos peleando con cada tecla.
 */
export const warehouseFormSchema = z.object({
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
  address: z.string().optional(),
  notes: z.string().optional(),
  isDefault: z.boolean(),
  active: z.boolean(),
});

export type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;
