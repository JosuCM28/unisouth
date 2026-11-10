"use server";

import { executeAction } from "@/lib/core/action-handler";
import {
  WORKSHOP_BOARDS,
  type WorkshopBoardKey,
} from "@/lib/constants/workshop-access";
import { WorkshopDeliveryService } from "@/lib/services/workshop-delivery.service";
import { boardDeliveryDetailSchema } from "@/lib/validations/workshop-board.schema";

/*
 * La ficha de una entrega, abierta desde un tablero.
 *
 * Una action por tablero y no una con el tablero como parámetro: cada una
 * exige SU llave, y `executeAction` revisa una llave fija antes de leer el
 * input. Con un parámetro, la llave dependería de lo que mande el navegador.
 * El taller sale del tablero —nunca de un id del cliente—, así que una
 * entrega de otro taller se contesta como si no existiera.
 */
function boardDetail(board: WorkshopBoardKey, input: unknown) {
  const { permission, role } = WORKSHOP_BOARDS[board];

  return executeAction(input, {
    schema: boardDeliveryDetailSchema,
    permission,
    handler: ({ input }) =>
      new WorkshopDeliveryService().requireDetailForRole(role, input.id),
  });
}

export async function acatlanDeliveryDetailAction(input: unknown) {
  return boardDetail("acatlan", input);
}

export async function sitexDeliveryDetailAction(input: unknown) {
  return boardDetail("sitex", input);
}

export async function broderieDeliveryDetailAction(input: unknown) {
  return boardDetail("broderie", input);
}

export async function allendeDeliveryDetailAction(input: unknown) {
  return boardDetail("allende", input);
}
