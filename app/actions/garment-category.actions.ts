"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import { garmentCategorySchema } from "@/lib/validations/garment-category.schema";
import { GarmentCategoryService } from "@/lib/services/garment-category.service";

/* Mismo dueño que el catálogo de productos (`bom:write`): el tipo de prenda
   es un atributo del producto, y separar la llave sólo daría a alguien poder
   sobre una mitad del catálogo sin la otra. */
const PERMISSION = "bom:write";
const REVALIDATE = ["/products"];

export async function createGarmentCategoryAction(input: unknown) {
  return executeAction(input, {
    schema: garmentCategorySchema, permission: PERMISSION, revalidate: REVALIDATE,
    successMessage: "Tipo de prenda agregado",
    handler: ({ input, auditContext }) => new GarmentCategoryService(auditContext).create(input),
  });
}

export async function updateGarmentCategoryAction(input: unknown) {
  return executeAction(input, {
    schema: z.object({ id: cuidSchema, data: garmentCategorySchema }),
    permission: PERMISSION, revalidate: REVALIDATE,
    successMessage: "Tipo de prenda actualizado",
    handler: ({ input, auditContext }) =>
      new GarmentCategoryService(auditContext).update(input.id, input.data),
  });
}

export async function removeGarmentCategoryAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema, permission: PERMISSION, revalidate: REVALIDATE,
    successMessage: "Tipo de prenda dado de baja",
    handler: ({ input, auditContext }) =>
      new GarmentCategoryService(auditContext).remove(input.id, input.reason),
  });
}
