"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema } from "@/lib/validations/common";
import { PackingService } from "@/lib/services/packing.service";
import {
  packingBoxIdSchema,
  packingMoveSchema,
  packingOrderIdSchema,
  packingOrderSchema,
  reopenPackingOrderSchema,
} from "@/lib/validations/packing.schema";

/* La lista, el pedido y la caja cuelgan de /packing; meter y sacar también
   mueve el inventario terminado. */
const REVALIDATE = ["/packing", "/finished-goods"];
const PERMISSION = "packing:write";

export async function createPackingOrderAction(input: unknown) {
  return executeAction(input, {
    schema: packingOrderSchema, permission: PERMISSION, revalidate: REVALIDATE,
    successMessage: "Pedido creado",
    handler: ({ input, auditContext }) => new PackingService(auditContext).create(input),
  });
}

export async function updatePackingOrderAction(input: unknown) {
  return executeAction(input, {
    schema: z.object({ id: cuidSchema, data: packingOrderSchema }), permission: PERMISSION,
    revalidate: REVALIDATE, successMessage: "Pedido actualizado",
    handler: ({ input, auditContext }) => new PackingService(auditContext).update(input.id, input.data),
  });
}

export async function removePackingOrderAction(input: unknown) {
  return executeAction(input, {
    schema: packingOrderIdSchema, permission: PERMISSION, revalidate: REVALIDATE,
    successMessage: "Pedido borrado",
    handler: ({ input, auditContext }) => new PackingService(auditContext).remove(input.id),
  });
}

export async function addPackingBoxAction(input: unknown) {
  return executeAction(input, {
    schema: packingOrderIdSchema, permission: PERMISSION, revalidate: REVALIDATE,
    handler: ({ input, auditContext }) => new PackingService(auditContext).addBox(input.id),
  });
}

export async function removePackingBoxAction(input: unknown) {
  return executeAction(input, {
    schema: packingBoxIdSchema, permission: PERMISSION, revalidate: REVALIDATE,
    successMessage: "Caja quitada",
    handler: ({ input, auditContext }) => new PackingService(auditContext).removeBox(input.boxId),
  });
}

export async function packAction(input: unknown) {
  return executeAction(input, {
    schema: packingMoveSchema, permission: PERMISSION, revalidate: REVALIDATE,
    successMessage: "Agregado a la caja",
    handler: ({ input, auditContext }) => new PackingService(auditContext).pack(input),
  });
}

export async function unpackAction(input: unknown) {
  return executeAction(input, {
    schema: packingMoveSchema, permission: PERMISSION, revalidate: REVALIDATE,
    successMessage: "Regresado al inventario",
    handler: ({ input, auditContext }) => new PackingService(auditContext).unpack(input),
  });
}

export async function closePackingOrderAction(input: unknown) {
  return executeAction(input, {
    schema: packingOrderIdSchema, permission: PERMISSION, revalidate: REVALIDATE,
    successMessage: "Pedido cerrado",
    handler: ({ input, auditContext }) => new PackingService(auditContext).close(input.id),
  });
}

export async function reopenPackingOrderAction(input: unknown) {
  return executeAction(input, {
    schema: reopenPackingOrderSchema, permission: PERMISSION, revalidate: REVALIDATE,
    successMessage: "Pedido reabierto",
    handler: ({ input, auditContext }) => new PackingService(auditContext).reopen(input.id, input.reason),
  });
}
