"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import {
  cancelGarmentShipmentSchema,
  removeGarmentShipmentSchema,
  garmentReturnSchema,
  garmentShipmentSchema,
  processStageSchema,
  workshopSchema,
} from "@/lib/validations/garment-shipment.schema";
import { GarmentShipmentService } from "@/lib/services/garment-shipment.service";
import { ProcessStageService } from "@/lib/services/process-stage.service";
import { WorkshopDeliveryService } from "@/lib/services/workshop-delivery.service";

/* La ficha de la orden es donde se ve el tablero, así que se revalida por id
   además de las listas: mandar un envío cambia justo la pantalla de la que se
   disparó.

   `/issues` entra porque un envío LEVANTA SU VALE, y ese vale vive en esa
   lista. Sin ella, mandar al taller y entrar al registro de salidas enseñaba
   la lista de antes: el vale existía en la base pero no se
   veía, y parecía que el envío no había dejado rastro. */
const REVALIDATE = ["/orders", "/dashboard", "/issues"];

export async function createGarmentShipmentAction(input: unknown) {
  return executeAction(input, {
    schema: garmentShipmentSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Envío registrado",
    handler: ({ input, auditContext }) =>
      new GarmentShipmentService(auditContext).create(input),
  });
}

/** Lo que el taller devolvió. Es la captura del día a día. */
export async function addGarmentReturnAction(input: unknown) {
  return executeAction(input, {
    schema: garmentReturnSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Retorno registrado",
    handler: ({ input, auditContext }) =>
      new GarmentShipmentService(auditContext).addReturn(input),
  });
}

/**
 * Borra un envío capturado por error.
 *
 * Su vale se cancela con él y tiene que dejar de verse vivo en el registro sin
 * que nadie recargue a mano; de eso ya se encarga `REVALIDATE`.
 */
export async function removeGarmentShipmentAction(input: unknown) {
  return executeAction(input, {
    schema: removeGarmentShipmentSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Envío eliminado",
    handler: ({ input, auditContext }) =>
      new GarmentShipmentService(auditContext).remove(input.id),
  });
}

export async function cancelGarmentShipmentAction(input: unknown) {
  return executeAction(input, {
    schema: cancelGarmentShipmentSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Envío cancelado",
    handler: ({ input, auditContext }) =>
      new GarmentShipmentService(auditContext).cancel(input.id, input.reason),
  });
}

/* ── Catálogos ──────────────────────────────────────────────────────────────
   Talleres y etapas pasan por su servicio como todo lo demás. Los talleres
   además pueden traer la cuenta con la que entra alguien, y eso tiene reglas
   y deja rastro. */

const CATALOG_REVALIDATE = ["/workshops", "/orders", "/workshop-orders"];

export async function createWorkshopAction(input: unknown) {
  return executeAction(input, {
    schema: workshopSchema,
    permission: "production:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Taller creado",
    handler: ({ input, auditContext }) =>
      new WorkshopDeliveryService(auditContext).createWorkshop(input),
  });
}

export async function updateWorkshopAction(input: unknown) {
  return executeAction(input, {
    schema: z.object({ id: cuidSchema, data: workshopSchema }),
    permission: "production:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Taller actualizado",
    handler: ({ input, auditContext }) =>
      new WorkshopDeliveryService(auditContext).updateWorkshop(
        input.id,
        input.data,
      ),
  });
}

export async function removeWorkshopAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "production:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Taller dado de baja",
    handler: ({ input, auditContext }) =>
      new WorkshopDeliveryService(auditContext).removeWorkshop(input.id),
  });
}

export async function createProcessStageAction(input: unknown) {
  return executeAction(input, {
    schema: processStageSchema,
    permission: "production:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Etapa creada",
    handler: ({ input, auditContext }) =>
      new ProcessStageService(auditContext).create(input),
  });
}

export async function updateProcessStageAction(input: unknown) {
  return executeAction(input, {
    schema: z.object({ id: cuidSchema, data: processStageSchema }),
    permission: "production:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Etapa actualizada",
    handler: ({ input, auditContext }) =>
      new ProcessStageService(auditContext).update(input.id, input.data),
  });
}

export async function removeProcessStageAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "production:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Etapa dada de baja",
    handler: ({ input, auditContext }) =>
      new ProcessStageService(auditContext).remove(input.id),
  });
}
