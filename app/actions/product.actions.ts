"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import { productSchema, quickProductSchema, sizeSchema } from "@/lib/validations/product.schema";
import { ProductService, SizeService } from "@/lib/services/product.service";

const REVALIDATE = ["/products", "/calculations"];

const updateProductSchema = z.object({ id: cuidSchema, data: productSchema });
const updateSizeSchema = z.object({ id: cuidSchema, data: sizeSchema });

export async function createProductAction(input: unknown) {
  return executeAction(input, {
    schema: productSchema, permission: "bom:write", revalidate: REVALIDATE,
    successMessage: "Producto creado",
    handler: ({ input, auditContext }) => new ProductService(auditContext).create(input),
  });
}

/* Alta rápida desde la salida a Embarques o la entrada manual. Llave propia:
   quien la usa no tiene por qué abrir fichas técnicas (`bom:write`). */
export async function quickCreateProductAction(input: unknown) {
  return executeAction(input, {
    schema: quickProductSchema, permission: "products:create", revalidate: ["/products"],
    successMessage: "Producto listo",
    handler: ({ input, auditContext }) => new ProductService(auditContext).quickCreate(input),
  });
}

export async function updateProductAction(input: unknown) {
  return executeAction(input, {
    schema: updateProductSchema, permission: "bom:write", revalidate: REVALIDATE,
    successMessage: "Producto actualizado",
    handler: ({ input, auditContext }) => new ProductService(auditContext).update(input.id, input.data),
  });
}

export async function removeProductAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema, permission: "bom:write", revalidate: REVALIDATE,
    successMessage: "Producto dado de baja",
    handler: ({ input, auditContext }) => new ProductService(auditContext).remove(input.id, input.reason),
  });
}

export async function createSizeAction(input: unknown) {
  return executeAction(input, {
    schema: sizeSchema, permission: "bom:write", revalidate: ["/sizes", ...REVALIDATE],
    successMessage: "Talla creada",
    handler: ({ input, auditContext }) => new SizeService(auditContext).create(input),
  });
}

export async function updateSizeAction(input: unknown) {
  return executeAction(input, {
    schema: updateSizeSchema, permission: "bom:write", revalidate: ["/sizes", ...REVALIDATE],
    successMessage: "Talla actualizada",
    handler: ({ input, auditContext }) => new SizeService(auditContext).update(input.id, input.data),
  });
}

export async function removeSizeAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema, permission: "bom:write", revalidate: ["/sizes", ...REVALIDATE],
    successMessage: "Talla desactivada",
    handler: ({ input, auditContext }) => new SizeService(auditContext).remove(input.id, input.reason),
  });
}
