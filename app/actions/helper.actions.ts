"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import { helperSchema } from "@/lib/validations/helper.schema";
import { HelperService } from "@/lib/services/helper.service";

const REVALIDATE = ["/helpers", "/receipts/new"];

const updateHelperSchema = z.object({ id: cuidSchema, data: helperSchema });

export async function createHelperAction(input: unknown) {
  return executeAction(input, {
    schema: helperSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Ayudante registrado",
    handler: ({ input, auditContext }) => new HelperService(auditContext).create(input),
  });
}

export async function updateHelperAction(input: unknown) {
  return executeAction(input, {
    schema: updateHelperSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Ayudante actualizado",
    handler: ({ input, auditContext }) => new HelperService(auditContext).update(input.id, input.data),
  });
}

export async function removeHelperAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Ayudante dado de baja",
    handler: ({ input, auditContext }) => new HelperService(auditContext).remove(input.id, input.reason),
  });
}
