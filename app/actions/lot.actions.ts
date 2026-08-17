"use server";

import { executeAction } from "@/lib/core/action-handler";
import {
  cancelLotSchema,
  createLotSchema,
  cutLotSchema,
  recountLotSchema,
  transferLotSchema,
  updateLotSchema,
} from "@/lib/validations/lot.schema";
import { LotService } from "@/lib/services/lot.service";

const REVALIDATE = ["/lots", "/dashboard"];

export async function createLotAction(input: unknown) {
  return executeAction(input, {
    schema: createLotSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Rollo dado de alta",
    handler: ({ input, auditContext }) =>
      new LotService(auditContext).create(input),
  });
}

export async function updateLotAction(input: unknown) {
  return executeAction(input, {
    schema: updateLotSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Rollo actualizado",
    handler: ({ input, auditContext }) =>
      new LotService(auditContext).update(input),
  });
}

export async function cutLotAction(input: unknown) {
  return executeAction(input, {
    schema: cutLotSchema,
    permission: "inventory:write",
    revalidate: REVALIDATE,
    successMessage: "Corte registrado",
    handler: ({ input, auditContext }) => new LotService(auditContext).cut(input),
  });
}

/**
 * Reconteo: exige `inventory:adjust`, NO `inventory:write`.
 *
 * Ajustar un saldo es corregir la realidad contra el sistema, y eso pesa más
 * que registrar una entrada o una salida normales: quien puede recontar puede
 * hacer desaparecer material sin que quede como una salida.
 */
export async function recountLotAction(input: unknown) {
  return executeAction(input, {
    schema: recountLotSchema,
    permission: "inventory:adjust",
    revalidate: REVALIDATE,
    successMessage: "Reconteo aplicado",
    handler: ({ input, auditContext }) =>
      new LotService(auditContext).recount(input),
  });
}

export async function transferLotAction(input: unknown) {
  return executeAction(input, {
    schema: transferLotSchema,
    permission: "inventory:write",
    revalidate: [...REVALIDATE, "/locations"],
    successMessage: "Rollo traspasado",
    handler: ({ input, auditContext }) =>
      new LotService(auditContext).transfer(input),
  });
}

/**
 * Cancelación (baja) de un rollo.
 *
 * Exige `inventory:adjust`, igual que el reconteo y por el mismo motivo:
 * cancelar hace desaparecer material del inventario sin que sea una salida,
 * y eso pesa más que registrar una entrada normal.
 *
 * El registro NO se borra: pasa a WRITTEN_OFF conservando su historial.
 */
export async function cancelLotAction(input: unknown) {
  return executeAction(input, {
    schema: cancelLotSchema,
    permission: "inventory:adjust",
    revalidate: REVALIDATE,
    successMessage: "Rollo cancelado",
    handler: ({ input, auditContext }) =>
      new LotService(auditContext).cancel(input),
  });
}
