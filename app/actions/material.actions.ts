"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import { materialSchema } from "@/lib/validations/material.schema";
import { MaterialService } from "@/lib/services/material.service";

const REVALIDATE = ["/materials", "/dashboard"];

/** La edición lleva el id además de todos los campos del alta. */
const updateMaterialSchema = z.object({
  id: cuidSchema,
  data: materialSchema,
});

export async function createMaterialAction(input: unknown) {
  return executeAction(input, {
    schema: materialSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Material creado",
    handler: ({ input, auditContext }) =>
      new MaterialService(auditContext).create(input),
  });
}

export async function updateMaterialAction(input: unknown) {
  return executeAction(input, {
    schema: updateMaterialSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Material actualizado",
    handler: ({ input, auditContext }) =>
      new MaterialService(auditContext).update(input.id, input.data),
  });
}

export async function removeMaterialAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Material dado de baja",
    handler: ({ input, auditContext }) =>
      new MaterialService(auditContext).remove(input.id, input.reason),
  });
}
