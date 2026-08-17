"use server";

import { executeAction } from "@/lib/core/action-handler";
import {
  updateWarehouseSchema,
  warehouseSchema,
} from "@/lib/validations/warehouse.schema";
import { WarehouseService } from "@/lib/services/warehouse.service";
import { z } from "zod";

// Cambiar un almacén reacomoda el mapa de bodega y las opciones de ubicación.
const REVALIDATE = ["/warehouses", "/locations", "/lots", "/dashboard"];

export async function createWarehouseAction(input: unknown) {
  return executeAction(input, {
    schema: warehouseSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Almacén creado",
    handler: ({ input, auditContext }) =>
      new WarehouseService(auditContext).create(input),
  });
}

export async function updateWarehouseAction(input: unknown) {
  return executeAction(input, {
    schema: updateWarehouseSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Almacén actualizado",
    handler: ({ input, auditContext }) =>
      new WarehouseService(auditContext).update(input),
  });
}

export async function removeWarehouseAction(input: unknown) {
  return executeAction(input, {
    schema: z.object({ id: z.string().min(1) }),
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Almacén dado de baja",
    handler: ({ input, auditContext }) =>
      new WarehouseService(auditContext).remove(input.id),
  });
}
