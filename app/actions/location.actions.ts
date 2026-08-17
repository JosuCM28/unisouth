"use server";

import { executeAction } from "@/lib/core/action-handler";
import { removeSchema } from "@/lib/validations/common";
import {
  locationSchema,
  updateLocationSchema,
} from "@/lib/validations/location.schema";
import { LocationService } from "@/lib/services/location.service";

/**
 * Capa delgada: declara esquema, permiso y rutas a refrescar, y delega al
 * servicio. Ni lógica de negocio ni llamadas a Prisma.
 */

const REVALIDATE = ["/locations", "/dashboard"];

export async function createLocationAction(input: unknown) {
  return executeAction(input, {
    schema: locationSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Ubicación creada",
    handler: ({ input, auditContext }) =>
      new LocationService(auditContext).create(input),
  });
}

export async function updateLocationAction(input: unknown) {
  return executeAction(input, {
    schema: updateLocationSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Ubicación actualizada",
    handler: ({ input, auditContext }) => {
      const { id, ...data } = input;
      return new LocationService(auditContext).update(id, data);
    },
  });
}

export async function removeLocationAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "catalog:write",
    revalidate: REVALIDATE,
    successMessage: "Ubicación dada de baja",
    handler: ({ input, auditContext }) =>
      new LocationService(auditContext).remove(input.id, input.reason),
  });
}
