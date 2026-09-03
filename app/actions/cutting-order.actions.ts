"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, requiredText } from "@/lib/validations/common";
import {
  batchProgressSchema,
  cuttingBatchSchema,
  cuttingOrderSchema,
  cuttingProgressSchema,
  orderCommentSchema,
} from "@/lib/validations/cutting-order.schema";
import { CuttingOrderService } from "@/lib/services/cutting-order.service";

const REVALIDATE = ["/orders", "/dashboard"];

/**
 * Mandar a salidas: la orden completa o UN corte suyo.
 *
 * `batchId` opcional porque las dos son la misma acción vista desde distinta
 * altura: sin él viaja todo lo cortado hasta hoy, con él sólo lo que dio ese
 * tendido.
 */
const sendToIssueSchema = z.object({
  id: cuidSchema,
  batchId: cuidSchema.optional(),
});
const updateSchema = z.object({ id: cuidSchema, data: cuttingOrderSchema });
const cancelSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo", 500),
});
/* Borrar exige motivo por la misma razón que cancelar: es una acción HIGH y
   `AuditService` no acepta una sin explicación. Antes la acción sólo recibía
   el id, así que el servicio llegaba al audit con `reason` vacío y el borrado
   fallaba SIEMPRE con "Este cambio requiere un motivo" —un motivo que la
   pantalla ni siquiera pedía. */
const removeSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo", 500),
});
/* Retirar un comentario interno NO pide motivo: es una nota de trabajo, no un
   asiento del kárdex. La auditoría igual registra quién y cuándo. */
const commentIdSchema = z.object({ id: cuidSchema });

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

/** Abre el siguiente corte de la orden. El número lo pone el servidor. */
export async function openCuttingBatchAction(input: unknown) {
  return executeAction(input, {
    schema: cuttingBatchSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Corte abierto",
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).openBatch(input),
  });
}

/**
 * Captura una tanda entera: un corte y varias tallas de un jalón.
 *
 * Es la acción principal del piso desde que existen los cortes; la de una sola
 * talla queda para correcciones.
 */
export async function saveBatchProgressAction(input: unknown) {
  return executeAction(input, {
    schema: batchProgressSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Corte capturado",
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).saveBatchProgress(input),
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
 * Borra la orden por completo.
 *
 * Cancelar y borrar no son lo mismo y por eso conviven: se cancela lo que se
 * hizo y ya no va —y su historial se consulta—, se borra lo que nunca debió
 * existir. La huella queda en la auditoría.
 */
export async function removeCuttingOrderAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Orden eliminada",
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).remove(input.id, input.reason),
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
    schema: sendToIssueSchema,
    permission: "inventory:write",
    revalidate: [...REVALIDATE, "/issues", "/documents"],
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).sendToIssue(input.id, input.batchId),
  });
}

/**
 * Agrega un comentario interno a la orden.
 *
 * Pide `inventory:write` igual que capturar un avance: quien puede trabajar
 * la orden puede anotar sobre ella. Leerlos no necesita nada aparte —los
 * pinta la propia ficha, que ya exige `inventory:browse`—.
 */
export async function addOrderCommentAction(input: unknown) {
  return executeAction(input, {
    schema: orderCommentSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).addComment(input),
  });
}

export async function deleteOrderCommentAction(input: unknown) {
  return executeAction(input, {
    schema: commentIdSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Comentario retirado",
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).removeComment(input.id),
  });
}
