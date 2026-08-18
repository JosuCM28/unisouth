import { z } from "zod";
import { fromDateInputValue } from "@/lib/utils";

/**
 * Piezas reutilizables de validación.
 *
 * Viven aquí para que "cantidad positiva" o "texto opcional" signifiquen
 * exactamente lo mismo en los ocho formularios del sistema.
 */

export const cuidSchema = z
  .string({ message: "Selecciona una opción" })
  .min(1, "Selecciona una opción")
  .regex(/^c[a-z0-9]{20,}$/i, "Identificador inválido");

export const optionalCuid = z
  .union([cuidSchema, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

/**
 * Texto opcional que NUNCA se guarda como cadena vacía.
 *
 * Un `<input>` vacío manda `""`, no `undefined`. Sin esta conversión la base
 * se llena de cadenas vacías que no son null y arruinan los `WHERE x IS NULL`.
 */
export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export function requiredText(label: string, max = 255) {
  return z
    // El mensaje va aquí y no sólo en el .min(): si el campo llega ausente o
    // como otro tipo, Zod usaría su texto en inglés y el usuario lo vería.
    .string({ message: `${label} es obligatorio` })
    .trim()
    .min(1, `${label} es obligatorio`)
    .max(max, `${label} no puede pasar de ${max} caracteres`);
}

/**
 * Número que llega como texto desde un input.
 *
 * Acepta coma decimal: el auxiliar teclea "12,5" porque así se escribe en
 * México, y el teclado del celular a veces sólo ofrece coma.
 */
export const numericString = z
  .union([z.string(), z.number()], { message: "Escribe un número válido" })
  .transform((value) => {
    if (typeof value === "number") return value;
    return Number(value.trim().replace(",", "."));
  })
  .refine((value) => Number.isFinite(value), "Escribe un número válido");

export const positiveQuantity = numericString.refine(
  (value) => value > 0,
  "La cantidad debe ser mayor que cero",
);

export const nonNegativeQuantity = numericString.refine(
  (value) => value >= 0,
  "La cantidad no puede ser negativa",
);

export const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return undefined;
    const parsed =
      typeof value === "number" ? value : Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  });

/** Mermas y márgenes: 0 a 100. Un 150% de merma es un dedazo, no un dato. */
export const percentage = numericString
  .refine((value) => value >= 0, "El porcentaje no puede ser negativo")
  .refine((value) => value <= 100, "El porcentaje no puede pasar de 100");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/** Baja de un registro de catálogo. El motivo queda en la auditoría. */
export const removeSchema = z.object({
  id: cuidSchema,
  reason: optionalText,
});

export type RemoveInput = z.infer<typeof removeSchema>;

/**
 * Fecha de un `<input type="date">`, anclada a la zona de la fábrica.
 *
 * `z.coerce.date()` interpreta "2026-08-17" como medianoche UTC, que en
 * Veracruz son las 6 de la tarde del día 16: una recepción capturada hoy
 * quedaba guardada con la fecha de ayer. Aquí el día elegido se ancla al
 * inicio de ESE día en la fábrica.
 *
 * Un `Date` que ya viene armado (de otro punto del servidor) pasa tal cual:
 * sólo se corrige lo que llega como texto del formulario.
 */
export const localDate = z.preprocess((value) => {
  if (typeof value !== "string") return value;

  // Sólo el formato del input; un ISO completo ya trae su propio desfase.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return fromDateInputValue(value);

  return value;
}, z.coerce.date());
