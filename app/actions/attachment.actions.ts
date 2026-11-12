"use server";

import { executeAction } from "@/lib/core/action-handler";
import { removeAttachmentSchema } from "@/lib/validations/attachment.schema";
import { AttachmentService } from "@/lib/services/attachment.service";

/**
 * Borra una foto o una ficha técnica de una orden.
 *
 * El borrado sí es una Server Action, a diferencia de la subida: aquí no viaja
 * un binario, sólo un id, así que no hay razón para salirse del camino que usa
 * todo lo demás —permiso, Zod y revalidación en un solo lugar—.
 *
 * El permiso declarado es sólo la PUERTA —`orders:browse`, lo que hace falta
 * para ver una orden— y la decisión real la toma `canWriteOrderFiles` adentro,
 * contra el origen de la orden.
 *
 * Es así porque no existe UNA llave que tengan los dos que deben poder borrar:
 * el almacén lleva `inventory:write` y quien captura en planta lleva
 * `plant-orders:write`, y ninguno tiene la del otro. Declarar cualquiera de
 * las dos aquí dejaba al otro fuera.
 *
 * Sólo lectura SÍ pasa esta puerta —ve las órdenes— y lo detiene la revisión
 * de adentro, que es la que de verdad manda.
 */
export async function removeAttachmentAction(input: unknown) {
  return executeAction(input, {
    schema: removeAttachmentSchema,
    permission: "orders:browse",
    revalidate: ["/orders", "/plant-orders"],
    successMessage: "Archivo eliminado",
    handler: ({ input, auditContext, user }) =>
      new AttachmentService(auditContext).removeAsRole(input.id, user.role),
  });
}
