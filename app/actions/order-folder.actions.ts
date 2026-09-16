"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, optionalCuid } from "@/lib/validations/common";
import {
  folderIssueSchema,
  folderWorkshopSchema,
  orderFolderSchema,
} from "@/lib/validations/order-folder.schema";
import { OrderFolderService } from "@/lib/services/order-folder.service";

const REVALIDATE = ["/orders", "/dashboard"];

/* Mandar el pedido entero LEVANTA VALES, y esos vales viven en las listas de
   salidas y documentos. Sin revalidarlas, el auxiliar entra al registro justo
   después y ve la lista de antes: el vale existe en la base pero no se ve, y
   parece que el botón no hizo nada. */
const SEND_REVALIDATE = [...REVALIDATE, "/issues", "/documents"];

const idSchema = z.object({ id: cuidSchema });
const updateSchema = z.object({ id: cuidSchema, data: orderFolderSchema });

/**
 * Mover una orden a un pedido.
 *
 * `folderId` ausente significa "déjala suelta", no "no cambies nada": es la
 * forma de sacar una orden de su carpeta sin una acción aparte.
 */
const moveSchema = z.object({
  orderId: cuidSchema,
  folderId: optionalCuid,
});

export async function createOrderFolderAction(input: unknown) {
  return executeAction(input, {
    schema: orderFolderSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Pedido creado",
    handler: ({ input, auditContext }) =>
      new OrderFolderService(auditContext).create(input),
  });
}

export async function updateOrderFolderAction(input: unknown) {
  return executeAction(input, {
    schema: updateSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Pedido actualizado",
    handler: ({ input, auditContext }) =>
      new OrderFolderService(auditContext).update(input.id, input.data),
  });
}

export async function archiveOrderFolderAction(input: unknown) {
  return executeAction(input, {
    schema: idSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Pedido archivado",
    handler: ({ input, auditContext }) =>
      new OrderFolderService(auditContext).archive(input.id),
  });
}

export async function unarchiveOrderFolderAction(input: unknown) {
  return executeAction(input, {
    schema: idSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Pedido reabierto",
    handler: ({ input, auditContext }) =>
      new OrderFolderService(auditContext).unarchive(input.id),
  });
}

/** Acomodar órdenes ya capturadas: el uso diario de las carpetas. */
export async function moveOrderToFolderAction(input: unknown) {
  return executeAction(input, {
    schema: moveSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Orden movida",
    handler: ({ input, auditContext }) =>
      new OrderFolderService(auditContext).moveOrder(
        input.orderId,
        input.folderId,
      ),
  });
}

export async function removeOrderFolderAction(input: unknown) {
  return executeAction(input, {
    schema: idSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Pedido eliminado",
    handler: ({ input, auditContext }) =>
      new OrderFolderService(auditContext).remove(input.id),
  });
}

/**
 * La salida global: un solo vale con lo cortado de todo el pedido.
 *
 * `inventory:write` y no `orders:browse`: esto CREA un documento con folio de
 * la serie OUT. Quien sólo consulta cómo va el pedido no lo levanta.
 *
 * Sólo viaja el id. Qué tallas y cuántos bultos salen lo decide el servidor
 * leyendo los cortes: si viniera del navegador, un vale podría salir con
 * piezas que nadie cortó.
 */
export async function sendFolderToIssueAction(input: unknown) {
  return executeAction(input, {
    schema: folderIssueSchema,
    permission: "inventory:write",
    revalidate: SEND_REVALIDATE,
    successMessage: "Salida global creada",
    handler: ({ input, auditContext }) =>
      new OrderFolderService(auditContext).sendToIssue(input.id),
  });
}

/** El envío global a taller: todo el pedido al mismo proceso, de un jalón. */
export async function sendFolderToWorkshopAction(input: unknown) {
  return executeAction(input, {
    schema: folderWorkshopSchema,
    permission: "inventory:write",
    revalidate: SEND_REVALIDATE,
    successMessage: "Pedido enviado al taller",
    handler: ({ input, auditContext }) =>
      new OrderFolderService(auditContext).sendToWorkshop(input.id, input),
  });
}
