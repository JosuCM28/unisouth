import { z } from "zod";
import { cuidSchema } from "./common";

/**
 * Tope de peso por foto.
 *
 * Ocho megas con el navegador reduciendo a 1600px es holgadísimo —una foto
 * así pesa unos 300 KB— y aun así deja pasar la que se suba desde una
 * computadora sin reducir. No es una regla de negocio: es el seguro contra
 * que alguien llene el disco del VPS subiendo un video renombrado.
 */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/**
 * Tope de peso por ficha técnica.
 *
 * Más alto que el de las fotos y por una razón concreta: una foto la reduce
 * el navegador antes de mandarla, y una ficha técnica llega tal como salió
 * del escáner —varias páginas, a veces con planos— y nadie la va a comprimir
 * antes de subirla. Con el tope de las fotos, media digitalización rebotaba.
 */
export const MAX_TECH_SHEET_BYTES = 10 * 1024 * 1024;

/**
 * Qué se está subiendo.
 *
 * Decide DOS cosas que no se pueden mezclar: qué tipos de archivo se aceptan
 * y con qué tope. Viaja en el formulario porque la misma ruta atiende los dos
 * bloques de la pantalla.
 */
export const attachmentKindSchema = z.enum(["PHOTO", "TECH_SHEET"]);
export type AttachmentKind = z.infer<typeof attachmentKindSchema>;

/** Borrar un archivo. Sólo el id: lo demás lo sabe el servidor. */
export const removeAttachmentSchema = z.object({ id: cuidSchema });
