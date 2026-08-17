"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema } from "@/lib/validations/common";
import {
  purchaseDecisionSchema, purchaseRequestSchema, rejectPurchaseSchema,
} from "@/lib/validations/purchase-request.schema";
import { PurchaseRequestService } from "@/lib/services/purchase-request.service";

const REVALIDATE = ["/purchase-requests", "/dashboard"];
const idSchema = z.object({ id: cuidSchema });
const fromCalculationSchema = z.object({ calculationId: cuidSchema });

export async function createPurchaseRequestAction(input: unknown) {
  return executeAction(input, {
    schema: purchaseRequestSchema, permission: "purchase:request", revalidate: REVALIDATE,
    successMessage: "Requisición creada",
    handler: ({ input, auditContext }) => new PurchaseRequestService(auditContext).create(input),
  });
}

export async function createFromCalculationAction(input: unknown) {
  return executeAction(input, {
    schema: fromCalculationSchema, permission: "purchase:request", revalidate: REVALIDATE,
    successMessage: "Requisición generada con los faltantes",
    handler: ({ input, auditContext }) =>
      new PurchaseRequestService(auditContext).createFromCalculation(input.calculationId),
  });
}

export async function submitPurchaseRequestAction(input: unknown) {
  return executeAction(input, {
    schema: idSchema, permission: "purchase:request", revalidate: REVALIDATE,
    successMessage: "Requisición enviada a autorización",
    handler: ({ input, auditContext }) => new PurchaseRequestService(auditContext).submit(input.id),
  });
}

/**
 * Autorizar exige `purchase:approve`, que sólo tienen PURCHASING y ADMIN.
 * El servicio lo vuelve a comprobar con el rol del usuario: la action valida
 * el permiso, el servicio la regla de negocio.
 */
export async function approvePurchaseRequestAction(input: unknown) {
  return executeAction(input, {
    schema: purchaseDecisionSchema, permission: "purchase:approve", revalidate: REVALIDATE,
    successMessage: "Requisición autorizada",
    handler: ({ input, user, auditContext }) =>
      new PurchaseRequestService(auditContext).approve(input.id, user.role),
  });
}

export async function rejectPurchaseRequestAction(input: unknown) {
  return executeAction(input, {
    schema: rejectPurchaseSchema, permission: "purchase:approve", revalidate: REVALIDATE,
    successMessage: "Requisición rechazada",
    handler: ({ input, user, auditContext }) =>
      new PurchaseRequestService(auditContext).reject(input.id, user.role, input.reason),
  });
}

export async function markOrderedAction(input: unknown) {
  return executeAction(input, {
    schema: idSchema, permission: "purchase:approve", revalidate: REVALIDATE,
    successMessage: "Marcada como pedida",
    handler: ({ input, auditContext }) => new PurchaseRequestService(auditContext).markOrdered(input.id),
  });
}

export async function markReceivedAction(input: unknown) {
  return executeAction(input, {
    schema: idSchema, permission: "purchase:approve", revalidate: REVALIDATE,
    successMessage: "Marcada como recibida",
    handler: ({ input, auditContext }) => new PurchaseRequestService(auditContext).markReceived(input.id),
  });
}
