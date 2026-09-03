import { z } from "zod";
import { cuidSchema, optionalCuid, optionalText, requiredText } from "./common";

/**
 * El catálogo visual de prendas: carpetas, prendas y dónde va cada marcado.
 *
 * Sigue la filosofía de formularios del proyecto —pocos campos obligatorios—
 * llevada al extremo: de una carpeta sólo el nombre, de una prenda sólo el
 * nombre, de un marcado sólo el nombre. Todo lo demás, la foto incluida, se
 * agrega cuando alguien camine hasta la prenda de muestra y la tome.
 */

/** El peso máximo de una foto YA reducida, en bytes. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Lo que el navegador puede reducir y el servidor volver a servir. */
const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Una foto recién subida, como data URL.
 *
 * Viaja en base64 dentro del payload de la Server Action y no como archivo
 * suelto porque así el alta de la prenda y su foto son UNA sola operación: con
 * dos llamadas, perder la conexión entre ellas dejaría la foto huérfana en la
 * base o la prenda sin ella, y en la bodega el WiFi se cae varias veces al día.
 *
 * Se recorta a 2 MB aunque el navegador ya la haya reducido: el límite del
 * cliente es una comodidad, no una defensa —cualquiera puede llamar la action
 * directamente— y sin tope aquí una sola petición podría meter 50 MB a la base.
 */
export const photoSchema = z.object({
  dataUrl: z
    .string()
    .regex(
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/,
      "La foto no se pudo leer. Vuelve a elegirla.",
    ),
  mimeType: z.enum(PHOTO_MIME_TYPES, {
    message: "Sólo se aceptan fotos JPG, PNG o WebP",
  }),
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
});

export type PhotoInput = z.infer<typeof photoSchema>;

/**
 * Qué hacer con la foto de algo que ya existe.
 *
 * Los tres estados son distintos y hay que poder decirlos: mandar una nueva,
 * quitar la que había, o no tocarla. Sin el tercero, editar el nombre de una
 * prenda le borraría la foto, que es el error que sólo se descubre después.
 */
export const photoEditSchema = z
  .union([photoSchema, z.literal("remove"), z.literal("keep")])
  .default("keep");

export const garmentFolderSchema = z.object({
  name: requiredText("El nombre", 120),
  clientId: optionalCuid,
  notes: optionalText,
});

export type GarmentFolderInput = z.infer<typeof garmentFolderSchema>;

export const garmentSchema = z.object({
  folderId: cuidSchema,
  name: requiredText("El nombre", 160),
  reference: optionalText,
  notes: optionalText,
  photo: photoEditSchema,
});

export type GarmentInput = z.infer<typeof garmentSchema>;

/** Al corregir una prenda la carpeta no se toca: para eso está "Mover". */
export const garmentUpdateSchema = garmentSchema.omit({ folderId: true });

export type GarmentUpdateInput = z.infer<typeof garmentUpdateSchema>;

/**
 * Un marcado: dónde va el bordado o la serigrafía.
 *
 * El nombre lleva la técnica dentro —"Manga izquierda bordado"— y no hay campo
 * aparte para ella a propósito: es como ya se escribe en el piso, y un
 * desplegable de técnicas obligaría a clasificar antes de poder anotar.
 */
export const placementSchema = z.object({
  garmentId: cuidSchema,
  name: requiredText("El nombre", 160),
  notes: optionalText,
  photo: photoEditSchema,
});

export type PlacementInput = z.infer<typeof placementSchema>;

export const placementUpdateSchema = placementSchema.omit({ garmentId: true });

export type PlacementUpdateInput = z.infer<typeof placementUpdateSchema>;

/** Reordenar arrastrando: la lista de marcados sigue el orden de la prenda. */
export const reorderSchema = z.object({
  ids: z.array(cuidSchema).min(1, "No hay nada que reordenar"),
});
