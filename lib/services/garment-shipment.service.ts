import type { GarmentShipment } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import type {
  GarmentReturnInput,
  GarmentShipmentInput,
} from "@/lib/validations/garment-shipment.schema";
import { BaseService } from "./base.service";

/**
 * El saldo de una talla dentro de una orden, en piezas.
 *
 * Es el equivalente en prendas del disponible de un rollo, y se calcula igual:
 * sumando la historia, nunca leyendo un campo que alguien tecleó.
 */
export interface SizeBalance {
  sizeId: string;
  /** Piezas que salieron del corte. */
  cut: number;
  /** Todo lo que ha salido a talleres, sumando envíos vivos. */
  sent: number;
  /** Lo que ha vuelto bueno. */
  returned: number;
  /** Lo que el taller perdió o echó a perder. No vuelve nunca. */
  scrap: number;
  /** Piezas que ahora mismo están en un taller. */
  atWorkshop: number;
  /** Piezas aquí, listas para mandar a la siguiente etapa. */
  available: number;
}

/**
 * Prendas ya cortadas que van y vienen de los talleres.
 *
 * Cubre el tramo que antes se llevaba en la libreta: la tela deja de ser rollo
 * al cortarse y la prenda terminada todavía no existe, así que la pieza que
 * anda bordándose no estaba en ningún lado. Por eso "¿cuánto de la 54 ya mandé
 * a bordar y cuánto me queda aquí?" no tenía respuesta.
 *
 * NO toca el kárdex, y es deliberado: la tela ya se descontó al cortar, y
 * volver a contar la prenda como existencia duplicaría el material.
 *
 * La regla que lo sostiene es la misma que la del almacén —no se surte por
 * encima del disponible—, traducida a piezas: no se manda a un taller más de
 * lo que hay aquí. Una prenda está en un solo lugar a la vez.
 */
export class GarmentShipmentService extends BaseService {
  async create(input: GarmentShipmentInput): Promise<GarmentShipment> {
    return this.transaction(async (tx) => {
      const order = await tx.cuttingOrder.findUnique({
        where: { id: input.orderId },
        select: { id: true, code: true, status: true },
      });
      if (!order) throw new NotFoundError("la orden", input.orderId);

      if (order.status === "CANCELLED") {
        throw new BusinessRuleError(
          `La orden ${order.code} está cancelada: no se puede mandar nada de ella.`,
        );
      }

      const balances = await this.balancesFor(tx, input.orderId);

      /* Se valida ANTES de escribir nada y contra el saldo recién leído: dos
         envíos capturados a la vez del mismo corte no pueden llevarse las
         mismas piezas. */
      for (const line of input.lines) {
        const balance = balances.get(line.sizeId);

        if (!balance) {
          throw new BusinessRuleError(
            "Esa talla no está en la orden. Agrégala a la orden antes de mandarla.",
          );
        }

        if (balance.cut === 0) {
          throw new BusinessRuleError(
            `De esa talla todavía no se corta nada: no hay piezas que mandar.`,
          );
        }

        if (line.sentQuantity > balance.available) {
          throw new BusinessRuleError(
            `Sólo quedan ${balance.available} piezas disponibles de esa talla: ${balance.cut} cortadas, ${balance.atWorkshop} en talleres. Registra el retorno antes de volver a mandarlas.`,
          );
        }
      }

      const code = await this.sequencesWith(tx).next(
        "GARMENT_SHIPMENT",
        "ENV",
        4,
      );

      const shipment = await tx.garmentShipment.create({
        data: {
          code,
          orderId: input.orderId,
          workshopId: input.workshopId,
          stageId: input.stageId,
          sentAt: input.sentAt ?? new Date(),
          dueDate: input.dueDate,
          reference: input.reference,
          notes: input.notes,
          createdById: this.context.userId,
          lines: {
            create: input.lines.map((line, index) => ({
              sizeId: line.sizeId,
              sentQuantity: line.sentQuantity,
              notes: line.notes,
              position: index,
            })),
          },
        },
      });

      await this.auditWith(tx).record({
        entity: "GarmentShipment",
        entityId: shipment.id,
        action: "CREATE",
        reference: code,
        newValue: {
          orden: order.code,
          tallas: input.lines.length,
          piezas: input.lines.reduce((sum, l) => sum + l.sentQuantity, 0),
        },
        sensitivity: "LOW",
      });

      return shipment;
    });
  }

  /**
   * Registra lo que el taller devolvió de una talla.
   *
   * El acumulado se recalcula sumando la bitácora del renglón y NO se
   * incrementa sobre el número guardado: si dos personas capturan retornos a
   * la vez, sumar sobre un valor leído antes perdería uno de los dos. Es la
   * misma razón por la que el saldo de un rollo se recalcula.
   */
  async addReturn(input: GarmentReturnInput) {
    return this.transaction(async (tx) => {
      const line = await tx.garmentShipmentLine.findUnique({
        where: { id: input.lineId },
        include: {
          size: { select: { code: true } },
          shipment: { select: { id: true, code: true, status: true } },
        },
      });
      if (!line) throw new NotFoundError("el renglón", input.lineId);

      if (line.shipment.status === "CANCELLED") {
        throw new BusinessRuleError(
          `El envío ${line.shipment.code} está cancelado.`,
        );
      }

      await tx.garmentReturn.create({
        data: {
          lineId: input.lineId,
          quantity: input.quantity,
          scrapQuantity: input.scrapQuantity,
          notes: input.notes,
          userId: this.context.userId,
        },
      });

      const totals = await tx.garmentReturn.aggregate({
        where: { lineId: input.lineId },
        _sum: { quantity: true, scrapQuantity: true },
      });

      const returned = totals._sum.quantity ?? 0;
      const scrap = totals._sum.scrapQuantity ?? 0;

      /* Un retorno no puede dejar el renglón en negativo: sería devolver más
         veces de las que se registraron, y sólo puede ser un error de captura. */
      if (returned < 0) {
        throw new BusinessRuleError(
          `El retorno dejaría la talla ${line.size.code} en negativo.`,
        );
      }

      // Ni puede volver más de lo que salió: el taller no fabrica piezas.
      if (returned + scrap > line.sentQuantity) {
        throw new BusinessRuleError(
          `De la talla ${line.size.code} salieron ${line.sentQuantity} piezas y estarías registrando ${returned + scrap}. Revisa el conteo.`,
        );
      }

      await tx.garmentShipmentLine.update({
        where: { id: input.lineId },
        data: { returnedQuantity: returned, scrapQuantity: scrap },
      });

      await this.syncStatus(tx, line.shipment.id);

      await this.auditWith(tx).record({
        entity: "GarmentShipment",
        entityId: line.shipment.id,
        action: "UPDATE",
        reference: `${line.shipment.code} · talla ${line.size.code}`,
        newValue: {
          regresaron: input.quantity,
          merma: input.scrapQuantity,
          acumulado: returned,
        },
        sensitivity: input.scrapQuantity > 0 ? "MEDIUM" : "LOW",
        reason: input.notes,
      });

      return { returnedQuantity: returned, scrapQuantity: scrap };
    });
  }

  /**
   * Cancela un envío que no debió existir.
   *
   * Sólo mientras no tenga retornos. Con piezas ya devueltas, cancelar
   * borraría el rastro de material que sí se movió; en ese caso lo correcto es
   * cerrar el envío registrando lo que falta como merma, que es lo que de
   * verdad pasó.
   */
  async cancel(id: string, reason: string): Promise<GarmentShipment> {
    return this.transaction(async (tx) => {
      const current = await tx.garmentShipment.findUnique({
        where: { id },
        include: { lines: { select: { returnedQuantity: true, scrapQuantity: true } } },
      });
      if (!current) throw new NotFoundError("el envío", id);

      if (current.status === "CANCELLED") {
        throw new BusinessRuleError(`El envío ${current.code} ya está cancelado.`);
      }

      const moved = current.lines.some(
        (line) => line.returnedQuantity !== 0 || line.scrapQuantity !== 0,
      );

      if (moved) {
        throw new BusinessRuleError(
          `El envío ${current.code} ya tiene retornos capturados y no se puede cancelar. Si el taller no va a devolver el resto, ciérralo registrándolo como merma.`,
        );
      }

      const shipment = await tx.garmentShipment.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      await this.auditWith(tx).record({
        entity: "GarmentShipment",
        entityId: id,
        action: "DELETE",
        reference: current.code,
        oldValue: { status: current.status },
        newValue: { status: "CANCELLED" },
        sensitivity: "MEDIUM",
        reason,
      });

      return shipment;
    });
  }

  /**
   * El tablero de la orden: en qué anda cada talla.
   *
   * Público porque la ficha de la orden lo pinta tal cual. Se calcula sumando
   * el corte y los envíos vivos; los cancelados no cuentan porque esas piezas
   * nunca salieron.
   */
  async balances(orderId: string): Promise<Map<string, SizeBalance>> {
    return this.balancesFor(this.db, orderId);
  }

  private async balancesFor(
    tx: PrismaExecutor,
    orderId: string,
  ): Promise<Map<string, SizeBalance>> {
    const [lines, shipmentLines] = await Promise.all([
      tx.cuttingOrderLine.findMany({
        where: { orderId },
        select: { sizeId: true, cutQuantity: true },
      }),
      tx.garmentShipmentLine.findMany({
        where: {
          shipment: { orderId, status: { not: "CANCELLED" } },
        },
        select: {
          sizeId: true,
          sentQuantity: true,
          returnedQuantity: true,
          scrapQuantity: true,
        },
      }),
    ]);

    const balances = new Map<string, SizeBalance>();

    /* El mapa se siembra con las tallas DE LA ORDEN: si una talla no está
       aquí, no se puede mandar, y esa es justamente la validación de arriba. */
    for (const line of lines) {
      balances.set(line.sizeId, {
        sizeId: line.sizeId,
        cut: line.cutQuantity,
        sent: 0,
        returned: 0,
        scrap: 0,
        atWorkshop: 0,
        available: line.cutQuantity,
      });
    }

    for (const line of shipmentLines) {
      const balance = balances.get(line.sizeId);
      if (!balance) continue;

      balance.sent += line.sentQuantity;
      balance.returned += line.returnedQuantity;
      balance.scrap += line.scrapQuantity;
    }

    for (const balance of balances.values()) {
      /* Una prenda está en un solo lugar a la vez: o en el taller, o aquí, o
         se perdió. Lo que volvió vuelve a estar disponible —es justo lo que
         permite mandarla a la siguiente etapa—, y la merma no vuelve nunca. */
      balance.atWorkshop = balance.sent - balance.returned - balance.scrap;
      balance.available = balance.cut - balance.sent + balance.returned;
    }

    return balances;
  }

  /**
   * El estado se deriva de los retornos, no se elige a mano.
   *
   * Que alguien tenga que acordarse de marcar un envío como cerrado es
   * garantía de que el tablero mienta.
   */
  private async syncStatus(tx: PrismaExecutor, shipmentId: string) {
    const lines = await tx.garmentShipmentLine.findMany({
      where: { shipmentId },
      select: {
        sentQuantity: true,
        returnedQuantity: true,
        scrapQuantity: true,
      },
    });

    const sent = lines.reduce((sum, l) => sum + l.sentQuantity, 0);
    const back = lines.reduce(
      (sum, l) => sum + l.returnedQuantity + l.scrapQuantity,
      0,
    );

    const status = back === 0 ? "SENT" : back >= sent ? "CLOSED" : "PARTIAL";

    await tx.garmentShipment.update({
      where: { id: shipmentId },
      data: {
        status,
        // Se sella al cerrar y se limpia si vuelve a abrirse por una
        // corrección: una fecha de cierre en un envío vivo confunde.
        closedAt: status === "CLOSED" ? new Date() : null,
      },
    });
  }
}
