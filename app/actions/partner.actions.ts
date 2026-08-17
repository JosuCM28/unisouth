"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import { carrierSchema, supplierSchema } from "@/lib/validations/partner.schema";
import { CarrierService, SupplierService } from "@/lib/services/partner.service";

const REVALIDATE = ["/partners", "/receipts/new"];

const updateCarrierSchema = z.object({ id: cuidSchema, data: carrierSchema });
const updateSupplierSchema = z.object({ id: cuidSchema, data: supplierSchema });

export async function createCarrierAction(input: unknown) {
  return executeAction(input, {
    schema: carrierSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Paquetería creada",
    handler: ({ input, auditContext }) => new CarrierService(auditContext).create(input),
  });
}

export async function updateCarrierAction(input: unknown) {
  return executeAction(input, {
    schema: updateCarrierSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Paquetería actualizada",
    handler: ({ input, auditContext }) => new CarrierService(auditContext).update(input.id, input.data),
  });
}

export async function removeCarrierAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Paquetería dada de baja",
    handler: ({ input, auditContext }) => new CarrierService(auditContext).remove(input.id, input.reason),
  });
}

export async function createSupplierAction(input: unknown) {
  return executeAction(input, {
    schema: supplierSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Proveedor creado",
    handler: ({ input, auditContext }) => new SupplierService(auditContext).create(input),
  });
}

export async function updateSupplierAction(input: unknown) {
  return executeAction(input, {
    schema: updateSupplierSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Proveedor actualizado",
    handler: ({ input, auditContext }) => new SupplierService(auditContext).update(input.id, input.data),
  });
}

export async function removeSupplierAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema, permission: "catalog:write", revalidate: REVALIDATE,
    successMessage: "Proveedor dado de baja",
    handler: ({ input, auditContext }) => new SupplierService(auditContext).remove(input.id, input.reason),
  });
}
