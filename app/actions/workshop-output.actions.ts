"use server";

import { executeAction } from "@/lib/core/action-handler";
import { WorkshopOutputService } from "@/lib/services/workshop-output.service";
import {
  cancelWorkshopOutputSchema,
  finishedOutputSchema,
  workshopOutputSchema,
} from "@/lib/validations/workshop-output.schema";

/* Los tableros y la orden: ahí se lee lo que salió. */
const REVALIDATE = ["/workshop-boards", "/orders"];

export async function createWorkshopOutputAction(input: unknown) {
  return executeAction(input, {
    schema: workshopOutputSchema,
    permission: "workshop-output:write",
    revalidate: REVALIDATE,
    successMessage: "Salida registrada",
    handler: ({ input, user, auditContext }) =>
      new WorkshopOutputService(auditContext).create(user.role, input),
  });
}

/* Embarques entra en las rutas: lo que sale de aquí aparece en su inventario. */
export async function createFinishedOutputAction(input: unknown) {
  return executeAction(input, {
    schema: finishedOutputSchema,
    permission: "workshop-output:write",
    revalidate: [...REVALIDATE, "/finished-goods"],
    successMessage: "Salida enviada a Embarques",
    handler: ({ input, user, auditContext }) =>
      new WorkshopOutputService(auditContext).createFinished(user.role, input),
  });
}

/** El taller cancela la suya; el rol decide de quién es. */
export async function cancelWorkshopOutputAction(input: unknown) {
  return executeAction(input, {
    schema: cancelWorkshopOutputSchema,
    permission: "workshop-output:write",
    revalidate: [...REVALIDATE, "/finished-goods"],
    successMessage: "Salida cancelada",
    handler: ({ input, user, auditContext }) =>
      new WorkshopOutputService(auditContext).cancel(input.id, input.reason, user.role),
  });
}

/*
 * ADMIN la cancela desde la ficha de la orden, de cualquier taller.
 *
 * Pide `cuts:unlock` —la llave de ADMIN para corregir lo que ya quedó
 * firmado— y no `workshop-output:write`: ésa se le carga al taller del rol que
 * entra, y ADMIN no es un taller.
 */
export async function cancelWorkshopOutputAsAdminAction(input: unknown) {
  return executeAction(input, {
    schema: cancelWorkshopOutputSchema,
    permission: "cuts:unlock",
    revalidate: [...REVALIDATE, "/finished-goods"],
    successMessage: "Salida cancelada",
    handler: ({ input, auditContext }) =>
      new WorkshopOutputService(auditContext).cancel(input.id, input.reason, null),
  });
}
