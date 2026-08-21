import type { CuttingOrder } from "@prisma/client";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import type {
  CuttingOrderInput,
  CuttingProgressInput,
} from "@/lib/validations/cutting-order.schema";
import { BaseService } from "./base.service";
import { DocumentService } from "./document.service";

/**
 * Órdenes de corte: qué pidió el cliente y cómo va el corte.
 *
 * El pedido se captura una vez y NO se toca: es la referencia contra la que se
 * mide todo lo demás. El avance se registra aparte, entrada por entrada, para
 * poder responder "cuánto falta" y también "cuándo se atoró esta orden".
 */
export class CuttingOrderService extends BaseService {
  async create(input: CuttingOrderInput): Promise<CuttingOrder> {
    return this.transaction(async (tx) => {
      const code = await this.sequencesWith(tx).next(
        "PRODUCTION_ORDER",
        "PO",
        4,
      );

      const order = await tx.cuttingOrder.create({
        data: {
          code,
          clientId: input.clientId,
          materialId: input.materialId,
          productionRunId: input.productionRunId,
          folderId: input.folderId,
          description: input.description,
          reference: input.reference,
          orderedAt: input.orderedAt ?? new Date(),
          dueDate: input.dueDate,
          notes: input.notes,
          createdById: this.context.userId,
          lines: {
            create: input.lines.map((line, index) => ({
              sizeId: line.sizeId,
              orderedQuantity: line.orderedQuantity,
              tagId: line.tagId,
              notes: line.notes,
              position: index,
            })),
          },
        },
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: order.id,
        action: "CREATE",
        reference: code,
        newValue: { code, lines: input.lines.length },
        sensitivity: "LOW",
      });

      return order;
    });
  }

  /**
   * Corrige el pedido.
   *
   * Los renglones se reemplazan, pero SÓLO los que no tienen avance: borrar
   * uno que ya lleva piezas cortadas tiraría su historial, y con él la
   * respuesta a "cuándo se cortó esto".
   */
  async update(id: string, input: CuttingOrderInput): Promise<CuttingOrder> {
    return this.transaction(async (tx) => {
      const current = await tx.cuttingOrder.findUnique({
        where: { id },
        include: { lines: { include: { _count: { select: { progress: true } } } } },
      });
      if (!current) throw new NotFoundError("la orden", id);

      if (current.status === "CANCELLED") {
        throw new BusinessRuleError(
          `La orden ${current.code} está cancelada y no se puede editar.`,
        );
      }

      const withProgress = current.lines.filter(
        (line) => line._count.progress > 0,
      );
      const keptSizeIds = new Set(withProgress.map((line) => line.sizeId));

      const removed = input.lines.length
        ? withProgress.filter(
            (line) => !input.lines.some((next) => next.sizeId === line.sizeId),
          )
        : withProgress;

      if (removed.length > 0) {
        throw new BusinessRuleError(
          `No se pueden quitar tallas que ya tienen avance capturado. Registra un avance negativo si el conteo estaba mal.`,
        );
      }

      // Los renglones sin avance se borran y se recrean; los que ya llevan
      // corte sólo se actualizan, conservando su historial.
      await tx.cuttingOrderLine.deleteMany({
        where: { orderId: id, sizeId: { notIn: [...keptSizeIds] } },
      });

      for (const [index, line] of input.lines.entries()) {
        const existing = withProgress.find(
          (kept) => kept.sizeId === line.sizeId,
        );

        if (existing) {
          await tx.cuttingOrderLine.update({
            where: { id: existing.id },
            data: {
              orderedQuantity: line.orderedQuantity,
              tagId: line.tagId,
              notes: line.notes,
              position: index,
            },
          });
          continue;
        }

        await tx.cuttingOrderLine.create({
          data: {
            orderId: id,
            sizeId: line.sizeId,
            orderedQuantity: line.orderedQuantity,
            tagId: line.tagId,
            notes: line.notes,
            position: index,
          },
        });
      }

      const order = await tx.cuttingOrder.update({
        where: { id },
        data: {
          clientId: input.clientId,
          materialId: input.materialId,
          productionRunId: input.productionRunId,
          /* `?? null` y no `input.folderId` a secas: si el usuario vacía el
             selector llega `undefined`, y Prisma ignora undefined —la orden
             se quedaría en la carpeta de la que se acaba de sacar. */
          folderId: input.folderId ?? null,
          description: input.description,
          reference: input.reference,
          orderedAt: input.orderedAt ?? current.orderedAt,
          dueDate: input.dueDate,
          notes: input.notes,
        },
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: id,
        action: "UPDATE",
        reference: order.code,
        oldValue: { lines: current.lines.length },
        newValue: { lines: input.lines.length },
        sensitivity: "LOW",
      });

      return order;
    });
  }

  /**
   * Registra que se cortaron N piezas de una talla.
   *
   * El total de la talla se recalcula sumando su bitácora y NO incrementando
   * el número guardado: si dos personas capturan avance a la vez, sumar sobre
   * un valor leído antes perdería uno de los dos. Es la misma razón por la que
   * el saldo de un rollo se recalcula y no se acumula a ciegas.
   */
  async addProgress(input: CuttingProgressInput) {
    return this.transaction(async (tx) => {
      const line = await tx.cuttingOrderLine.findUnique({
        where: { id: input.lineId },
        include: { order: true, size: { select: { code: true } } },
      });
      if (!line) throw new NotFoundError("el renglón", input.lineId);

      if (line.order.status === "CANCELLED") {
        throw new BusinessRuleError(
          `La orden ${line.order.code} está cancelada.`,
        );
      }

      await tx.cuttingProgress.create({
        data: {
          lineId: input.lineId,
          quantity: input.quantity,
          notes: input.notes,
          userId: this.context.userId,
        },
      });

      const total = await tx.cuttingProgress.aggregate({
        where: { lineId: input.lineId },
        _sum: { quantity: true },
      });
      const cut = total._sum.quantity ?? 0;

      /* Un avance no puede dejar el total en negativo: sería un corte que se
         deshizo más veces de las que se hizo, y sólo puede ser un error de
         captura. */
      if (cut < 0) {
        throw new BusinessRuleError(
          `El avance dejaría la talla ${line.size.code} en negativo.`,
        );
      }

      await tx.cuttingOrderLine.update({
        where: { id: input.lineId },
        data: { cutQuantity: cut },
      });

      await this.syncStatus(tx, line.orderId);

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: line.orderId,
        action: "UPDATE",
        reference: `${line.order.code} · talla ${line.size.code}`,
        newValue: { avance: input.quantity, acumulado: cut },
        sensitivity: "LOW",
        reason: input.notes,
      });

      return { cutQuantity: cut };
    });
  }

  /** Cancela la orden. No se borra: su historial de corte debe conservarse. */
  async cancel(id: string, reason: string): Promise<CuttingOrder> {
    return this.transaction(async (tx) => {
      const current = await tx.cuttingOrder.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("la orden", id);

      const order = await tx.cuttingOrder.update({
        where: { id },
        data: { status: "CANCELLED", closedAt: new Date() },
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: id,
        action: "DELETE",
        reference: current.code,
        oldValue: { status: current.status },
        newValue: { status: "CANCELLED" },
        sensitivity: "MEDIUM",
        reason,
      });

      return order;
    });
  }

  /**
   * Manda una orden ya cortada a Salidas como BORRADOR.
   *
   * Existe porque el flujo real era capturar dos veces lo mismo: la orden ya
   * tiene el cliente, la tela y el desglose talla por talla, y para darle
   * salida había que volver a teclearlo todo. Aquí se copia lo que coincide y
   * el resto —los rollos que se descuentan, quién recibe— se completa en el
   * vale, que es donde vive esa información.
   *
   * Se copia lo CORTADO y no lo pedido: lo que sale por la puerta son las
   * prendas que ya existen. Una talla sin avance no tiene nada que entregar,
   * así que no viaja; si luego se corta, se manda otro vale.
   *
   * Nace en DRAFT y sin renglones de rollo, que es un estado válido para una
   * salida: lo que se entrega son prendas ya cortadas, no tela por descontar.
   * El vale NO se aplica aquí —eso mueve inventario y es un acto deliberado
   * del auxiliar— ni la orden cambia de estado: mandar el papel al taller no
   * es cortar más.
   */
  async sendToIssue(orderId: string): Promise<{ id: string; code: string }> {
    return this.transaction(async (tx) => {
      const order = await tx.cuttingOrder.findUnique({
        where: { id: orderId },
        include: {
          lines: {
            orderBy: { position: "asc" },
            select: {
              sizeId: true,
              cutQuantity: true,
              tagId: true,
              notes: true,
            },
          },
        },
      });

      if (!order) throw new NotFoundError("la orden", orderId);

      if (order.status === "CANCELLED") {
        throw new BusinessRuleError(
          "Una orden cancelada no puede mandarse a salidas.",
        );
      }

      const cutLines = order.lines
        .filter((line) => line.cutQuantity > 0)
        .map((line) => ({
          sizeId: line.sizeId,
          quantity: line.cutQuantity,
          // Un bulto por talla: cuántos son de verdad se sabe al empacar, y
          // el auxiliar lo corrige en el vale. Poner cero sería mentir.
          bundles: 1,
          tagId: line.tagId ?? undefined,
          notes: line.notes ?? undefined,
        }));

      if (cutLines.length === 0) {
        throw new BusinessRuleError(
          "Esta orden todavía no tiene piezas cortadas que entregar.",
        );
      }

      /* El vale se crea por DocumentService y no con un `create` suelto: es la
         única puerta a los documentos y la que genera el folio de la serie
         OUT. Se le pasa `tx` para que el borrador y su auditoría se confirmen
         junto con esta transacción. */
      const document = await new DocumentService(this.context, tx).create({
        type: "ISSUE",
        date: new Date(),
        clientId: order.clientId ?? undefined,
        productionRunId: order.productionRunId ?? undefined,
        // De dónde salió, en el papel que firma el taller.
        concept: order.description ?? undefined,
        reference: order.reference ?? order.code,
        handedOverBy: undefined,
        receivedBy: undefined,
        notes: order.notes ?? undefined,
        // Sin rollos: el vale sale con puro desglose y el auxiliar agrega la
        // tela a descontar si hace falta.
        lines: [],
        cutLines,
        cutDescription: order.description ?? undefined,
        cutFabricId: order.materialId ?? undefined,
        cutFabricText: undefined,
        cutPattern: undefined,
        cutVersion: undefined,
        cutVersionNotes: undefined,
        cutNotes: [],
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: order.id,
        action: "UPDATE",
        reference: order.code,
        newValue: { sentToIssue: document.code, cutLines: cutLines.length },
        sensitivity: "LOW",
      });

      return { id: document.id, code: document.code };
    });
  }

  /**
   * El estado se deriva del avance, no se elige a mano.
   *
   * Que alguien tenga que acordarse de marcar una orden como terminada es
   * garantía de que el tablero mienta: se calcula de lo que ya está capturado.
   */
  private async syncStatus(
    tx: Parameters<Parameters<BaseService["transaction"]>[0]>[0],
    orderId: string,
  ) {
    const lines = await tx.cuttingOrderLine.findMany({
      where: { orderId },
      select: { orderedQuantity: true, cutQuantity: true },
    });

    const ordered = lines.reduce((sum, l) => sum + l.orderedQuantity, 0);
    const cut = lines.reduce((sum, l) => sum + l.cutQuantity, 0);

    const status =
      cut === 0 ? "OPEN" : cut >= ordered ? "COMPLETED" : "IN_PROGRESS";

    await tx.cuttingOrder.update({
      where: { id: orderId },
      data: {
        status,
        // Se sella al terminar y se limpia si vuelve a abrirse por una
        // corrección: una fecha de cierre en una orden viva confunde.
        closedAt: status === "COMPLETED" ? new Date() : null,
      },
    });
  }
}
