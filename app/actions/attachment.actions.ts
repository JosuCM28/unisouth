"use server";

import { executeAction } from "@/lib/core/action-handler";
import { removeAttachmentSchema } from "@/lib/validations/attachment.schema";
import { AttachmentService } from "@/lib/services/attachment.service";

/**
 * Borra una foto de una orden.
 *
 * El borrado sí es una Server Action, a diferencia de la subida: aquí no viaja
 * un binario, sólo un id, así que no hay razón para salirse del camino que usa
 * todo lo demás —permiso, Zod y revalidación en un solo lugar—.
 *
 * `inventory:write`: Sólo lectura ve las fotos pero no las quita. Esconderle
 * el botón es comodidad; esta línea es la que lo impide de verdad.
 */
export async function removeAttachmentAction(input: unknown) {
  return executeAction(input, {
    schema: removeAttachmentSchema,
    permission: "inventory:write",
    revalidate: ["/orders"],
    successMessage: "Foto eliminada",
    handler: ({ input, auditContext }) =>
      new AttachmentService(auditContext).remove(input.id),
  });
}
