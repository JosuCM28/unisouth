"use server";

import { executeAction } from "@/lib/core/action-handler";
import { OrderDispatchService } from "@/lib/services/order-dispatch.service";
import {
  markOrderDispatchedSchema,
  orderDispatchOptionsSchema,
} from "@/lib/validations/order-dispatch.schema";

/* `/workshop-orders` entra porque el taller lee ahí que ya salió. */
const REVALIDATE = ["/orders", "/workshop-orders", "/issues"];

/** Se pide al abrir el diálogo: la tabla no carga esto para cada renglón. */
export async function listOrderDispatchOptionsAction(input: unknown) {
  return executeAction(input, {
    schema: orderDispatchOptionsSchema,
    permission: "inventory:write",
    handler: ({ input, auditContext }) =>
      new OrderDispatchService(auditContext).optionsFor(input.orderId),
  });
}

export async function markOrderDispatchedAction(input: unknown) {
  return executeAction(input, {
    schema: markOrderDispatchedSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Marcado como enviado",
    handler: ({ input, auditContext }) =>
      new OrderDispatchService(auditContext).markDispatched(input),
  });
}
