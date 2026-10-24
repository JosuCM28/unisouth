import type { InventoryDocument } from "@prisma/client";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import { summarizeFabric } from "@/lib/order-fabric";
import { OrderFabricRepository } from "@/lib/repositories/order-fabric.repository";
import { documentSchema } from "@/lib/validations/document.schema";
import type { PrismaExecutor } from "@/lib/prisma";
import type {
  IssueToOrdersInput,
  ReturnFabricInput,
} from "@/lib/validations/order-fabric.schema";
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
 * La SALIDA es un vale de salida normal ligado a la orden, que pasa por
 * DocumentService como cualquier otro. Este servicio agrega la devolución y
 * la salida a varias órdenes de un jalón, que arma esos mismos vales.
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

  /**
   * Saca tela para VARIAS órdenes en una sola captura: un vale por orden.
   *
   * Un vale por orden y no uno con renglones de distintas órdenes: el consumo
   * neto, la devolución y la pestaña de tela de cada orden leen el vale por su
   * `cuttingOrderId`, y un vale compartido tendría que mentir sobre a quién le
   * tocó cada rollo. Así cada orden queda igual que si se le hubiera sacado su
   * tela desde su propia ficha.
   *
   * Todos nacen en BORRADOR y en la misma transacción: si una orden falla no
   * queda la mitad de los vales creados, y ninguno descuenta hasta aplicarlo.
   */
  async issueToOrders(input: IssueToOrdersInput): Promise<IssuedVoucher[]> {
    return this.transaction(async (tx) => {
      const orders = await tx.cuttingOrder.findMany({
        where: { id: { in: input.orders.map((target) => target.orderId) } },
        select: {
          id: true,
          code: true,
          status: true,
          clientId: true,
          materialId: true,
        },
      });
      const orderOf = new Map(orders.map((order) => [order.id, order]));

      for (const target of input.orders) {
        const order = orderOf.get(target.orderId);
        if (!order) throw new NotFoundError("la orden", target.orderId);
        if (order.status === "CANCELLED") {
          throw new BusinessRuleError(
            `La orden ${order.code} está cancelada y ya no recibe tela.`,
          );
        }
      }

      await assertLotsCover(tx, input);

      const documentService = new DocumentService(this.context, tx);
      const issued: IssuedVoucher[] = [];

      for (const target of input.orders) {
        const order = orderOf.get(target.orderId)!;

        /* El mismo encabezado con el que nace la salida desde la ficha de la
           orden: su cliente, su folio y su tela. */
        const draft = await documentService.create(
          documentSchema.parse({
            type: "ISSUE",
            clientId: order.clientId ?? undefined,
            cuttingOrderId: order.id,
            reference: order.code,
            cutFabricId: order.materialId ?? undefined,
            receivedBy: input.receivedBy,
            notes: input.notes,
            lines: target.lines,
          }),
        );

        issued.push({ id: draft.id, code: draft.code, orderCode: order.code });
      }

      return issued;
    });
  }
}

/** El vale que nació para una orden en la salida múltiple. */
export interface IssuedVoucher {
  id: string;
  code: string;
  orderCode: string;
}

/**
 * Un rollo repartido entre varias órdenes no puede sumar más de lo que tiene.
 *
 * Partir un rollo es normal —60 m a una orden y 40 a otra—, pero cada vale
 * por separado se ve bien y el exceso sólo saltaría al aplicar el último,
 * cuando los otros ya descontaron. Se revisa la suma aquí, de una vez.
 */
async function assertLotsCover(
  tx: PrismaExecutor,
  input: IssueToOrdersInput,
): Promise<void> {
  const requested = new Map<string, number>();
  for (const line of input.orders.flatMap((target) => target.lines)) {
    requested.set(line.lotId, (requested.get(line.lotId) ?? 0) + line.quantity);
  }

  const lots = await tx.lot.findMany({
    where: { id: { in: [...requested.keys()] } },
    select: {
      id: true,
      code: true,
      currentQuantity: true,
      reservedQuantity: true,
    },
  });

  if (lots.length !== requested.size) {
    throw new BusinessRuleError(
      "Uno de los rollos de la salida ya no existe. Recarga la pantalla.",
    );
  }

  for (const lot of lots) {
    const available =
      Number(lot.currentQuantity) - Number(lot.reservedQuantity);
    const quantity = requested.get(lot.id) ?? 0;

    if (quantity > available + EPSILON) {
      throw new BusinessRuleError(
        `Entre todas las órdenes le estás sacando ${quantity} al rollo ${lot.code} y sólo tiene ${available} disponible.`,
      );
    }
  }
}
