import type { InventoryDocument } from "@prisma/client";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import { summarizeFabric } from "@/lib/order-fabric";
import { OrderFabricRepository } from "@/lib/repositories/order-fabric.repository";
import { documentSchema } from "@/lib/validations/document.schema";
import type { ReturnFabricInput } from "@/lib/validations/order-fabric.schema";
import { BaseService } from "./base.service";
import { DocumentService } from "./document.service";

/**
 * Margen para el ruido de los decimales al comparar metros: 0.1 + 0.2 no es
 * 0.3 en flotante y no se vale rechazar una devolución exacta por eso.
 */
const EPSILON = 0.0001;

/**
 * Tela de una orden: lo que se le sacó y lo que regresó.
 *
 * La SALIDA no vive aquí: es un vale de salida normal ligado a la orden, que
 * pasa por DocumentService como cualquier otro. Este servicio sólo agrega la
 * devolución, que es el único paso propio de la orden.
 */
export class OrderFabricService extends BaseService {
  /**
   * Regresa tela de la orden al almacén.
   *
   * Nace aplicada y no en borrador: quien devuelve ya tiene el rollo en la
   * mano y el saldo tiene que reflejarlo al momento; obligarlo a un segundo
   * paso de "aplicar" es de donde salen devoluciones que se quedan sin
   * registrar. Es un INBOUND sobre el mismo rollo, así que el kárdex conserva
   * la salida y el regreso como dos asientos.
   *
   * Nadie puede regresar más de lo que la orden se llevó de ESE rollo: sin
   * el tope, una devolución mal tecleada inflaría el inventario con tela que
   * nunca salió.
   */
  async returnFabric(input: ReturnFabricInput): Promise<InventoryDocument> {
    return this.transaction(async (tx) => {
      const order = await tx.cuttingOrder.findUnique({
        where: { id: input.orderId },
        select: { id: true, code: true, clientId: true },
      });

      if (!order) throw new NotFoundError("la orden", input.orderId);

      const documents = await new OrderFabricRepository(tx).documentsOfOrder(
        order.id,
      );
      const { rolls } = summarizeFabric(documents);
      const balanceOf = new Map(rolls.map((roll) => [roll.lotId, roll]));

      // Un mismo rollo dos veces en la captura se suma: el tope es por rollo.
      const requested = new Map<string, number>();
      for (const line of input.lines) {
        requested.set(
          line.lotId,
          (requested.get(line.lotId) ?? 0) + line.quantity,
        );
      }

      for (const [lotId, quantity] of requested) {
        const roll = balanceOf.get(lotId);

        if (!roll || roll.net <= EPSILON) {
          throw new BusinessRuleError(
            `El rollo ${roll?.lotCode ?? lotId} no tiene tela pendiente de regresar en ${order.code}.`,
          );
        }

        if (quantity > roll.net + EPSILON) {
          throw new BusinessRuleError(
            `A ${order.code} sólo le quedan ${roll.net} sin regresar del rollo ${roll.lotCode}; no puedes devolver ${quantity}.`,
          );
        }
      }

      const documentService = new DocumentService(this.context, tx);

      /* Por el esquema y no a mano: es la misma puerta que usa el formulario y
         rellena el encabezado de corte vacío que `create` espera. */
      const draft = await documentService.create(
        documentSchema.parse({
          type: "PRODUCTION_RETURN",
          clientId: order.clientId ?? undefined,
          // La liga con la orden: es lo que hace que cuente en su consumo.
          cuttingOrderId: order.id,
          concept: `Devolución de tela de ${order.code}`,
          reference: order.code,
          notes: input.notes,
          lines: [...requested].map(([lotId, quantity]) => ({
            lotId,
            quantity,
            unit: balanceOf.get(lotId)!.unit,
          })),
        }),
      );

      return documentService.apply(draft.id);
    });
  }
}
