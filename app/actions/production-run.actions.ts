"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import { productionRunSchema } from "@/lib/validations/production-run.schema";
import { ProductionRunService } from "@/lib/services/production-run.service";

const REVALIDATE = ["/production-runs", "/dashboard"];

const updateProductionRunSchema = z.object({
  id: cuidSchema,
  data: productionRunSchema,
});

export async function createProductionRunAction(input: unknown) {
  return executeAction(input, {
    schema: productionRunSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Producción creada",
    handler: ({ input, auditContext }) =>
      new ProductionRunService(auditContext).create(input),
  });
}

export async function updateProductionRunAction(input: unknown) {
  return executeAction(input, {
    schema: updateProductionRunSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Producción actualizada",
    handler: ({ input, auditContext }) =>
      new ProductionRunService(auditContext).update(input.id, input.data),
  });
}

export async function cancelProductionRunAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Producción cancelada",
    handler: ({ input, auditContext }) =>
      new ProductionRunService(auditContext).cancel(input.id, input.reason),
  });
}
