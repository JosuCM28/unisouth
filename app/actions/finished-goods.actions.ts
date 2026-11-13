"use server";

import { executeAction } from "@/lib/core/action-handler";
import { FinishedGoodsRepository } from "@/lib/repositories/finished-goods.repository";
import { FinishedGoodsService } from "@/lib/services/finished-goods.service";
import {
  adjustFinishedGoodsSchema,
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

/** El kárdex de un renglón, para la ventana que lo abre. Sólo lectura. */
export async function finishedMovementsAction(input: unknown) {
  return executeAction(input, {
    schema: finishedMovementsQuerySchema,
    permission: "finished-goods:browse",
    handler: ({ input }) => new FinishedGoodsRepository().findMovements(input.stockId),
  });
}
