"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import { cutTagSchema } from "@/lib/validations/cut-tag.schema";
import { CutTagService } from "@/lib/services/cut-tag.service";

/* Las salidas también se revalidan: el desglose de corte ofrece estos colores
   y una lista desactualizada haría elegir un foleo que ya no existe. */
const REVALIDATE = ["/cut-tags", "/issues/new"];

const updateCutTagSchema = z.object({ id: cuidSchema, data: cutTagSchema });

export async function createCutTagAction(input: unknown) {
  return executeAction(input, {
    schema: cutTagSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Foleo agregado",
    handler: ({ input, auditContext }) =>
      new CutTagService(auditContext).create(input),
  });
}

export async function updateCutTagAction(input: unknown) {
  return executeAction(input, {
    schema: updateCutTagSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Foleo actualizado",
    handler: ({ input, auditContext }) =>
      new CutTagService(auditContext).update(input.id, input.data),
  });
}

export async function removeCutTagAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Foleo dado de baja",
    handler: ({ input, auditContext }) =>
      new CutTagService(auditContext).remove(input.id, input.reason),
  });
}
