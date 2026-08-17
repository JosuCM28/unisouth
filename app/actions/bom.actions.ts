"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema } from "@/lib/validations/common";
import { bomSchema } from "@/lib/validations/bom.schema";
import { BomService } from "@/lib/services/bom.service";

const REVALIDATE = ["/boms", "/products", "/calculations"];

const updateBomSchema = z.object({ id: cuidSchema, data: bomSchema });
const activateBomSchema = z.object({ id: cuidSchema });

export async function createBomAction(input: unknown) {
  return executeAction(input, {
    schema: bomSchema, permission: "bom:write", revalidate: REVALIDATE,
    successMessage: "Ficha técnica creada",
    handler: ({ input, auditContext }) => new BomService(auditContext).create(input),
  });
}

/**
 * Si la ficha ya se usó en un cálculo, el servicio crea una v2 en vez de
 * editarla. El mensaje se ajusta en el cliente según `versioned`.
 */
export async function updateBomAction(input: unknown) {
  return executeAction(input, {
    schema: updateBomSchema, permission: "bom:write", revalidate: REVALIDATE,
    handler: ({ input, auditContext }) => new BomService(auditContext).update(input.id, input.data),
  });
}

export async function activateBomAction(input: unknown) {
  return executeAction(input, {
    schema: activateBomSchema, permission: "bom:write", revalidate: REVALIDATE,
    successMessage: "Ficha activada",
    handler: ({ input, auditContext }) => new BomService(auditContext).activate(input.id),
  });
}
