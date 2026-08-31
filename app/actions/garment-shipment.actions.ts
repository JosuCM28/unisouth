"use server";

import { z } from "zod";
import { executeAction } from "@/lib/core/action-handler";
import { prisma } from "@/lib/prisma";
import { cuidSchema, removeSchema } from "@/lib/validations/common";
import {
  cancelGarmentShipmentSchema,
  garmentReturnSchema,
  garmentShipmentSchema,
  processStageSchema,
  workshopSchema,
} from "@/lib/validations/garment-shipment.schema";
import { GarmentShipmentService } from "@/lib/services/garment-shipment.service";

/* La ficha de la orden es donde se ve el tablero, así que se revalida por id
   además de las listas: mandar un envío cambia justo la pantalla de la que se
   disparó. */
const REVALIDATE = ["/orders", "/dashboard"];

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
   Talleres y etapas son catálogos planos: no tienen reglas de negocio propias
   más allá de existir, así que las acciones hablan con Prisma sin un servicio
   de por medio, igual que el resto de los catálogos del sistema. */

const CATALOG_REVALIDATE = ["/workshops", "/orders"];

export async function createWorkshopAction(input: unknown) {
  return executeAction(input, {
    schema: workshopSchema,
    permission: "catalog:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Taller creado",
    handler: ({ input }) => prisma.workshop.create({ data: input }),
  });
}

export async function updateWorkshopAction(input: unknown) {
  return executeAction(input, {
    schema: z.object({ id: cuidSchema, data: workshopSchema }),
    permission: "catalog:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Taller actualizado",
    handler: ({ input }) =>
      prisma.workshop.update({ where: { id: input.id }, data: input.data }),
  });
}

/** Baja lógica: un taller borrado dejaría envíos apuntando a la nada. */
export async function removeWorkshopAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "catalog:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Taller dado de baja",
    handler: ({ input }) =>
      prisma.workshop.update({
        where: { id: input.id },
        data: { active: false, deletedAt: new Date() },
      }),
  });
}

export async function createProcessStageAction(input: unknown) {
  return executeAction(input, {
    schema: processStageSchema,
    permission: "catalog:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Etapa creada",
    handler: ({ input }) => prisma.processStage.create({ data: input }),
  });
}

export async function updateProcessStageAction(input: unknown) {
  return executeAction(input, {
    schema: z.object({ id: cuidSchema, data: processStageSchema }),
    permission: "catalog:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Etapa actualizada",
    handler: ({ input }) =>
      prisma.processStage.update({ where: { id: input.id }, data: input.data }),
  });
}

export async function removeProcessStageAction(input: unknown) {
  return executeAction(input, {
    schema: removeSchema,
    permission: "catalog:write",
    revalidate: CATALOG_REVALIDATE,
    successMessage: "Etapa dada de baja",
    handler: ({ input }) =>
      prisma.processStage.update({
        where: { id: input.id },
        data: { active: false, deletedAt: new Date() },
      }),
  });
}
