"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import { clientSchema } from "@/lib/validations/client.schema";
import { ClientService } from "@/lib/services/client.service";

const REVALIDATE = ["/clients", "/dashboard"];

const updateClientSchema = z.object({ id: cuidSchema, data: clientSchema });

export async function createClientAction(input: unknown) {
  return executeAction(input, {
    schema: clientSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Cliente creado",
    handler: ({ input, auditContext }) =>
      new ClientService(auditContext).create(input),
  });
}

export async function updateClientAction(input: unknown) {
  return executeAction(input, {
    schema: updateClientSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Cliente actualizado",
    handler: ({ input, auditContext }) =>
      new ClientService(auditContext).update(input.id, input.data),
  });
}

export async function removeClientAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Cliente dado de baja",
    handler: ({ input, auditContext }) =>
      new ClientService(auditContext).remove(input.id, input.reason),
  });
}
