"use server";

import { executeAction } from "@/lib/core/action-handler";
import { FinishedGoodsRepository } from "@/lib/repositories/finished-goods.repository";
import { FinishedGoodsService } from "@/lib/services/finished-goods.service";
import {
  adjustFinishedGoodsSchema,
  assignFinishedPoSchema,
  changeFinishedPoSchema,
  finishedMovementsQuerySchema,
} from "@/lib/validations/finished-goods.schema";

export async function adjustFinishedGoodsAction(input: unknown) {
  return executeAction(input, {
    schema: adjustFinishedGoodsSchema,
    permission: "finished-goods:adjust",
    revalidate: ["/finished-goods"],
    successMessage: "Inventario ajustado",
    handler: ({ input, auditContext }) => new FinishedGoodsService(auditContext).adjust(input),
  });
}

/** Ponerle PO a lo que está "Sin PO": Embarques y ADMIN. */
export async function assignFinishedPoAction(input: unknown) {
  return executeAction(input, {
    schema: assignFinishedPoSchema,
    permission: "finished-goods:adjust",
    revalidate: ["/finished-goods"],
    successMessage: "PO asignada",
    handler: ({ input, auditContext }) => new FinishedGoodsService(auditContext).assignPo(input),
  });
}

/**
 * Cambiar una PO que ya traían: sólo ADMIN. Llave aparte y no un `if` de rol
 * en el servicio, para que la barrera sea la misma de toda la app.
 */
export async function changeFinishedPoAction(input: unknown) {
  return executeAction(input, {
    schema: changeFinishedPoSchema,
    permission: "finished-goods:edit-po",
    revalidate: ["/finished-goods"],
    successMessage: "PO cambiada",
    handler: ({ input, auditContext }) => new FinishedGoodsService(auditContext).changePo(input),
  });
}

/** El kárdex de un renglón, para la ventana que lo abre. Sólo lectura. */
export async function finishedMovementsAction(input: unknown) {
  return executeAction(input, {
    schema: finishedMovementsQuerySchema,
    permission: "finished-goods:browse",
    handler: ({ input }) => new FinishedGoodsRepository().findMovements(input.stockId),
  });
}
