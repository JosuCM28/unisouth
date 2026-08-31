"use server";

import { z } from "zod";
import type { Unit } from "@prisma/client";
import { executeAction } from "@/lib/core/action-handler";
import { cuidSchema } from "@/lib/validations/common";
import { LotRepository } from "@/lib/repositories/lot.repository";
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
    /* También /issues y /movements: el reconteo se dispara desde el vale de
       salida, y el ajuste que genera tiene que aparecer en el kárdex sin que
       nadie recargue a mano. */
    revalidate: [...REVALIDATE, "/issues", "/movements"],
    successMessage: "Reconteo aplicado",
    handler: ({ input, auditContext }) =>
      new LotService(auditContext).recount(input),
  });
}

/**
 * Lo que hay que saber de un rollo para corregirlo desde otra pantalla.
 *
 * Es de lectura y por eso pide `inventory:read`: enseñar el saldo no es
 * ajustarlo. El reconteo en sí sigue exigiendo `inventory:adjust`.
 */
export interface LotCorrectionInfo {
  code: string;
  materialName: string;
  unit: Unit;
  currentQuantity: number;
  reservedQuantity: number;
  /** Falso en cuanto el rollo tiene una salida o un ajuste encima. */
  canChangeUnit: boolean;
}

export async function lotCorrectionInfoAction(input: unknown) {
  return executeAction(input, {
    schema: z.object({ lotId: cuidSchema }),
    permission: "inventory:read",
    handler: async ({ input }): Promise<LotCorrectionInfo> => {
      const lot = await new LotRepository().findForCorrection(input.lotId);

      return {
        code: lot.code,
        materialName: lot.material.name,
        unit: lot.unit,
        currentQuantity: Number(lot.currentQuantity),
        reservedQuantity: Number(lot.reservedQuantity),
        canChangeUnit: lot._count.movements === 0,
      };
    },
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
