"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema } from "@/lib/validations/common";
import { cancelDocumentSchema, documentSchema } from "@/lib/validations/document.schema";
import { DocumentService } from "@/lib/services/document.service";

const REVALIDATE = ["/documents", "/issues", "/lots", "/dashboard"];

const updateDocumentSchema = z.object({ id: cuidSchema, data: documentSchema });
const applySchema = z.object({ id: cuidSchema });
const duplicateSchema = z.object({ id: cuidSchema });

export async function createDocumentAction(input: unknown) {
  return executeAction(input, {
    schema: documentSchema, permission: "inventory:write", revalidate: REVALIDATE,
    successMessage: "Documento creado en borrador",
    handler: ({ input, auditContext }) => new DocumentService(auditContext).create(input),
  });
}

export async function updateDocumentAction(input: unknown) {
  return executeAction(input, {
    schema: updateDocumentSchema, permission: "inventory:write", revalidate: REVALIDATE,
    successMessage: "Documento actualizado",
    handler: ({ input, auditContext }) => new DocumentService(auditContext).update(input.id, input.data),
  });
}

/**
 * Duplicar sólo CREA un borrador: no toca existencias, así que basta
 * inventory:write, el mismo permiso que capturar la salida a mano.
 */
export async function duplicateDocumentAction(input: unknown) {
  return executeAction(input, {
    schema: duplicateSchema, permission: "inventory:write", revalidate: REVALIDATE,
    successMessage: "Copia creada en borrador",
    handler: ({ input, auditContext }) => new DocumentService(auditContext).duplicate(input.id),
  });
}

/** Aplicar mueve inventario de verdad: exige inventory:write. */
export async function applyDocumentAction(input: unknown) {
  return executeAction(input, {
    schema: applySchema, permission: "inventory:write", revalidate: REVALIDATE,
    successMessage: "Documento aplicado",
    handler: ({ input, auditContext }) => new DocumentService(auditContext).apply(input.id),
  });
}

/**
 * Cancelar genera movimientos INVERSOS y se audita como CRITICAL.
 * Por eso exige inventory:adjust, no sólo inventory:write.
 */
export async function cancelDocumentAction(input: unknown) {
  return executeAction(input, {
    schema: cancelDocumentSchema, permission: "inventory:adjust", revalidate: REVALIDATE,
    successMessage: "Documento cancelado",
    handler: ({ input, auditContext }) => new DocumentService(auditContext).cancel(input.id, input.reason),
  });
}
