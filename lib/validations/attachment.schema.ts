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

/** Borrar una foto. Sólo el id: lo demás lo sabe el servidor. */
export const removeAttachmentSchema = z.object({ id: cuidSchema });
