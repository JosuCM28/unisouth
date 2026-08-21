"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, requiredText } from "@/lib/validations/common";
import {
  cuttingOrderSchema,
  cuttingProgressSchema,
} from "@/lib/validations/cutting-order.schema";
import { CuttingOrderService } from "@/lib/services/cutting-order.service";

const REVALIDATE = ["/orders", "/dashboard"];

const idSchema = z.object({ id: cuidSchema });
const updateSchema = z.object({ id: cuidSchema, data: cuttingOrderSchema });
const cancelSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo", 500),
});

export async function createCuttingOrderAction(input: unknown) {
  return executeAction(input, {
    schema: cuttingOrderSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Orden creada",
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).create(input),
  });
}

export async function updateCuttingOrderAction(input: unknown) {
  return executeAction(input, {
    schema: updateSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Orden actualizada",
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).update(input.id, input.data),
  });
}

/** Registrar avance es la acción del día a día: se usa desde el piso. */
export async function addCuttingProgressAction(input: unknown) {
  return executeAction(input, {
    schema: cuttingProgressSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Avance registrado",
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).addProgress(input),
  });
}

export async function cancelCuttingOrderAction(input: unknown) {
  return executeAction(input, {
    schema: cancelSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Orden cancelada",
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).cancel(input.id, input.reason),
  });
}

/**
 * Manda la orden a Salidas como borrador.
 *
 * Revalida también `/issues` y `/documents`: el vale nuevo tiene que
 * aparecer en el registro sin que haya que recargar a mano.
 */
export async function sendOrderToIssueAction(input: unknown) {
  return executeAction(input, {
    schema: idSchema,
    permission: "inventory:write",
    revalidate: [...REVALIDATE, "/issues", "/documents"],
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).sendToIssue(input.id),
  });
}
