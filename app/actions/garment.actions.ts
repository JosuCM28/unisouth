"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import {
  garmentFolderSchema,
  garmentSchema,
  garmentUpdateSchema,
  placementSchema,
  placementUpdateSchema,
  reorderSchema,
} from "@/lib/validations/garment.schema";
import { GarmentService } from "@/lib/services/garment.service";

/* La lista de carpetas y la carpeta abierta. Las rutas con id se revalidan
   además por su cuenta, porque `revalidatePath` no acepta comodines. */
const REVALIDATE = ["/garments"];

const updateFolderSchema = z.object({
  id: cuidSchema,
  data: garmentFolderSchema,
});

const updateGarmentSchema = z.object({
  id: cuidSchema,
  data: garmentUpdateSchema,
});

const moveGarmentSchema = z.object({
  id: cuidSchema,
  folderId: cuidSchema,
});

const updatePlacementSchema = z.object({
  id: cuidSchema,
  data: placementUpdateSchema,
});

const reorderPlacementsSchema = reorderSchema.extend({
  garmentId: cuidSchema,
});

// ── Carpetas ───────────────────────────────────────────────────────────────

export async function createGarmentFolderAction(input: unknown) {
  return executeAction(input, {
    schema: garmentFolderSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Carpeta creada",
    handler: ({ input, auditContext }) =>
      new GarmentService(auditContext).createFolder(input),
  });
}

export async function updateGarmentFolderAction(input: unknown) {
  return executeAction(input, {
    schema: updateFolderSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Carpeta actualizada",
    handler: ({ input, auditContext }) =>
      new GarmentService(auditContext).updateFolder(input.id, input.data),
  });
}

export async function removeGarmentFolderAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Carpeta borrada",
    handler: ({ input, auditContext }) =>
      new GarmentService(auditContext).removeFolder(input.id, input.reason),
  });
}

// ── Prendas ────────────────────────────────────────────────────────────────

export async function createGarmentAction(input: unknown) {
  return executeAction(input, {
    schema: garmentSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Prenda agregada",
    handler: ({ input, auditContext }) =>
      new GarmentService(auditContext).createGarment(input),
  });
}

export async function updateGarmentAction(input: unknown) {
  return executeAction(input, {
    schema: updateGarmentSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Prenda actualizada",
    handler: ({ input, auditContext }) =>
      new GarmentService(auditContext).updateGarment(input.id, input.data),
  });
}

export async function moveGarmentAction(input: unknown) {
  return executeAction(input, {
    schema: moveGarmentSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Prenda movida",
    handler: ({ input, auditContext }) =>
      new GarmentService(auditContext).moveGarment(input.id, input.folderId),
  });
}

export async function removeGarmentAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Prenda borrada",
    handler: ({ input, auditContext }) =>
      new GarmentService(auditContext).removeGarment(input.id, input.reason),
  });
}

// ── Marcados ───────────────────────────────────────────────────────────────

export async function createPlacementAction(input: unknown) {
  return executeAction(input, {
    schema: placementSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Marcado agregado",
    handler: ({ input, auditContext }) =>
      new GarmentService(auditContext).createPlacement(input),
  });
}

export async function updatePlacementAction(input: unknown) {
  return executeAction(input, {
    schema: updatePlacementSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Marcado actualizado",
    handler: ({ input, auditContext }) =>
      new GarmentService(auditContext).updatePlacement(input.id, input.data),
  });
}

export async function removePlacementAction(input: unknown) {
  return executeAction(input, {
    schema: z.object({ id: cuidSchema }),
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Marcado quitado",
    handler: ({ input, auditContext }) =>
      new GarmentService(auditContext).removePlacement(input.id),
  });
}

export async function reorderPlacementsAction(input: unknown) {
  return executeAction(input, {
    schema: reorderPlacementsSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Orden guardado",
    handler: ({ input, auditContext }) =>
      new GarmentService(auditContext).reorderPlacements(
        input.garmentId,
        input.ids,
      ),
  });
}
