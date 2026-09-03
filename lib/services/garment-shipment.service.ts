import type { CutVersion, GarmentShipment } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import { bundlePieces, sumBundlePieces } from "@/lib/bundles";
import type {
  GarmentReturnInput,
  GarmentShipmentInput,
} from "@/lib/validations/garment-shipment.schema";
import { BaseService } from "./base.service";
import { DocumentService } from "./document.service";

/** Lo que se ha mandado de una talla a UNA etapa. */
export interface StageCount {
  stageId: string;
  stageName: string;
  sent: number;
  returned: number;
  scrap: number;
}

/**
 * Cómo va una talla de la orden, etapa por etapa.
 *
 * NO hay un "disponible" global, y es la corrección más importante de este
 * módulo: lo que sale a bordar son PANELES —las tapas y el delantero
 * izquierdo—, no la prenda. Los demás paneles de esas mismas 100 camisas
 * siguen en la bodega. Restarlas de un saldo único diría que ya no las tienes,
 * y es falso: mandar a bordado no te impide mandar esas mismas piezas a armado.
 *
 * Por eso cada etapa lleva su propia cuenta contra lo cortado.
 */
export interface SizeBalance {
  sizeId: string;
  cut: number;
  byStage: Map<string, StageCount>;
}

/**
 * Prendas ya cortadas que salen a un taller a que les hagan un proceso.
 *
 * Cubre el tramo que se llevaba en la libreta: la tela deja de ser rollo al
 * cortarse y la prenda terminada todavía no existe, así que los paneles que
 * andan bordándose no estaban en ningún lado.
 *
 * Dos hechos del negocio que definen el diseño:
 *
 * 1. Lo que sale casi nunca vuelve. El taller borda los paneles y los manda
 *    directo a donde siguen. Por eso el retorno es la EXCEPCIÓN y no el paso
 *    que cierra el ciclo: un envío se queda en "enviado" para siempre y eso
 *    está bien.
 * 2. Sale una parte de la prenda, no la prenda. De ahí que no exista un saldo
 *    global de piezas y que cada etapa cuente aparte.
 *
 * NO toca el kárdex: la tela ya se descontó al cortar, y volver a contar la
 * prenda como existencia duplicaría el material.
 */
export class GarmentShipmentService extends BaseService {
  /**
   * Registra lo que salió y levanta su vale de salida.
   *
   * El vale nace en BORRADOR y con el mismo desglose por talla, porque ese
   * papel ya se hacía a mano: generarlo aquí es lo que evita capturar dos
   * veces el mismo renglón. No se aplica solo —eso es un acto deliberado del
   * auxiliar— y no descuenta tela, porque lo que sale son prendas cortadas.
   */
  async create(input: GarmentShipmentInput): Promise<GarmentShipment> {
    return this.transaction(async (tx) => {
      const order = await tx.cuttingOrder.findUnique({
        where: { id: input.orderId },
        include: { lines: { select: { sizeId: true } } },
      });
      if (!order) throw new NotFoundError("la orden", input.orderId);

      if (order.status === "CANCELLED") {
        throw new BusinessRuleError(
          `La orden ${order.code} está cancelada: no se puede mandar nada de ella.`,
        );
      }

      const [workshop, stage] = await Promise.all([
        tx.workshop.findUnique({
          where: { id: input.workshopId },
          select: { name: true },
        }),
        tx.processStage.findUnique({
          where: { id: input.stageId },
          select: { name: true },
        }),
      ]);
      if (!workshop) throw new NotFoundError("el taller", input.workshopId);
      if (!stage) throw new NotFoundError("la etapa", input.stageId);

      /* Lo ÚNICO que se valida de las cantidades es que la talla pertenezca a
         la orden. No hay tope contra lo cortado a propósito: en el piso se
         manda a bordar lo que hace falta y el conteo del corte no siempre está
         capturado al día. Un bloqueo aquí pararía el camión por un dato que se
         captura después. */
      const orderSizes = new Set(order.lines.map((line) => line.sizeId));

      for (const line of input.lines) {
        if (!orderSizes.has(line.sizeId)) {
          throw new BusinessRuleError(
            "Esa talla no está en la orden. Agrégala a la orden antes de mandarla.",
          );
        }
      }

      const code = await this.sequencesWith(tx).next(
        "GARMENT_SHIPMENT",
        "ENV",
        4,
      );

      const sentAt = input.sentAt ?? new Date();

      const shipment = await tx.garmentShipment.create({
        data: {
          code,
          orderId: input.orderId,
          workshopId: input.workshopId,
          stageId: input.stageId,
          sentAt,
          dueDate: input.dueDate,
          parts: input.parts,
          reference: input.reference,
          notes: input.notes,
          createdById: this.context.userId,
          lines: {
            create: input.lines.map((line, index) => ({
              sizeId: line.sizeId,
              sentQuantity: line.sentQuantity,
              bundles: line.bundles,
              notes: line.notes,
              position: index,
            })),
          },
        },
      });

      const document = await this.buildVoucher(tx, {
        shipmentCode: code,
        sentAt,
        stageName: stage.name,
        workshopName: workshop.name,
        parts: input.parts,
        order,
        lines: input.lines,
      });

      await tx.garmentShipment.update({
        where: { id: shipment.id },
        data: { documentId: document.id },
      });

      await this.auditWith(tx).record({
        entity: "GarmentShipment",
        entityId: shipment.id,
        action: "CREATE",
        reference: code,
        newValue: {
          orden: order.code,
          etapa: stage.name,
          taller: workshop.name,
          vale: document.code,
          bultos: input.lines.reduce((sum, l) => sum + l.bundles, 0),
          piezas: sumBundlePieces(
            input.lines.map((l) => ({
              quantity: l.sentQuantity,
              bundles: l.bundles,
            })),
          ),
        },
        sensitivity: "LOW",
      });

      return shipment;
    });
  }

  /**
   * El vale de salida del envío, con la forma del que ya se hacía a mano.
   *
   * El encabezado viaja completo desde la orden —prenda, tela, molde, versión—
   * porque es donde se supo, y la etapa y el taller se anotan arriba de las
   * notas del corte: así es como el taller lee el papel que recibe.
   */
  private async buildVoucher(
    tx: PrismaExecutor,
    input: {
      shipmentCode: string;
      sentAt: Date;
      stageName: string;
      workshopName: string;
      parts?: string;
      order: {
        code: string;
        clientId: string | null;
        productionRunId: string | null;
        materialId: string | null;
        description: string | null;
        cutFabricText: string | null;
        cutPattern: string | null;
        cutVersion: CutVersion | null;
        cutVersionNotes: string | null;
        cutNotes: string[];
      };
      lines: {
        sizeId: string;
        sentQuantity: number;
        bundles: number;
        notes?: string;
      }[];
    },
  ) {
    const { order } = input;

    /* La etapa y el taller encabezan las notas porque es lo primero que se
       lee en el papel: "BORDADO SHAWCOR". Las partes van abajo cuando se
       capturaron, y si no, el auxiliar las escribe a mano como siempre. */
    const cutNotes = [
      `${input.stageName.toUpperCase()} ${input.workshopName.toUpperCase()}`,
      ...(input.parts ? [input.parts] : []),
      ...order.cutNotes,
    ];

    return new DocumentService(this.context, tx).create({
      type: "ISSUE",
      date: input.sentAt,
      clientId: order.clientId ?? undefined,
      productionRunId: order.productionRunId ?? undefined,
      /* A propósito SIN la liga a la orden, aunque este vale sea suyo: el
         envío ya la trae por su propio camino (`GarmentShipment.orderId`) y
         la ficha lo pinta en "En talleres". Ligarlo también por aquí haría
         que la misma entrega saliera dos veces en la pantalla, una en cada
         bloque, como si hubieran salido dos. */
      cuttingOrderId: undefined,
      cuttingBatchId: undefined,
      concept: order.description ?? undefined,
      // El folio de la orden, que es contra lo que el taller cotiza y cobra.
      reference: order.code,
      // Quien entrega se firma en el papel, no se teclea aquí.
      handedOverBy: undefined,
      receivedBy: input.workshopName,
      notes: `Envío ${input.shipmentCode}`,
      // Sin rollos: lo que sale son prendas cortadas, no tela por descontar.
      lines: [],
      /* Copia literal de lo capturado, renglón por renglón: la talla que viajó
         en dos bultos de cuentas distintas sale en el papel como dos renglones,
         que es como el taller la recibe y la cuenta al firmar. */
      cutLines: input.lines.map((line) => ({
        sizeId: line.sizeId,
        quantity: line.sentQuantity,
        bundles: line.bundles,
        // El foleo se pone en el vale: al mandar a bordar todavía no se sabe
        // con qué color va a viajar el bulto.
        tagId: undefined,
        notes: line.notes,
      })),
      cutDescription: order.description ?? undefined,
      cutFabricId: order.materialId ?? undefined,
      cutFabricText: order.cutFabricText ?? undefined,
      cutPattern: order.cutPattern ?? undefined,
      cutVersion: order.cutVersion ?? undefined,
      cutVersionNotes: order.cutVersionNotes ?? undefined,
      cutNotes,
    });
  }

  /**
   * Registra lo que el taller devolvió de una talla.
   *
   * Es la EXCEPCIÓN: lo normal es que el taller mande los paneles bordados a
   * donde siguen y no vuelvan aquí. Existe porque de vez en cuando sí regresan
   * —y porque cuando regresan mal hay que dejarlo escrito.
   *
   * El acumulado se recalcula sumando la bitácora del renglón y NO se
   * incrementa sobre el número guardado: si dos personas capturan a la vez,
   * sumar sobre un valor leído antes perdería uno de los dos.
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

      if (returned < 0) {
        throw new BusinessRuleError(
          `El retorno dejaría la talla ${line.size.code} en negativo.`,
        );
      }

      /* Lo que salió de VERDAD en este renglón: la cantidad es por bulto, y
         comparar contra ella sin multiplicar rebotaría el retorno completo de
         un renglón de tres bultos. */
      const sent = bundlePieces({
        quantity: line.sentQuantity,
        bundles: line.bundles,
      });

      // No puede volver más de lo que salió: el taller no fabrica piezas.
      if (returned + scrap > sent) {
        throw new BusinessRuleError(
          `De la talla ${line.size.code} salieron ${sent} piezas y estarías registrando ${returned + scrap}. Revisa el conteo.`,
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
   * Sólo mientras no tenga retornos: con piezas ya devueltas, cancelar
   * borraría el rastro de material que sí se movió.
   *
   * El vale que generó NO se cancela solo. Es un documento con vida propia
   * —pudo aplicarse ya— y decidir por él desde aquí sería moverle existencias
   * a alguien por un motivo que no es suyo. Se avisa y se cancela aparte.
   */
  async cancel(id: string, reason: string): Promise<GarmentShipment> {
    return this.transaction(async (tx) => {
      const current = await tx.garmentShipment.findUnique({
        where: { id },
        include: {
          lines: { select: { returnedQuantity: true, scrapQuantity: true } },
        },
      });
      if (!current) throw new NotFoundError("el envío", id);

      if (current.status === "CANCELLED") {
        throw new BusinessRuleError(
          `El envío ${current.code} ya está cancelado.`,
        );
      }

      const moved = current.lines.some(
        (line) => line.returnedQuantity !== 0 || line.scrapQuantity !== 0,
      );

      if (moved) {
        throw new BusinessRuleError(
          `El envío ${current.code} ya tiene retornos capturados y no se puede cancelar.`,
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
   * Borra un envío capturado por error.
   *
   * Distinto de cancelar: cancelar deja constancia de que algo salió y se
   * echó atrás; borrar es para el envío que nunca debió existir —el taller
   * equivocado, la etapa equivocada, un dedazo al capturar—. Eso no es
   * historia del taller, es basura, y dejarlo cancelado para siempre ensucia
   * la ficha de la orden.
   *
   * Su vale se CANCELA, no se borra: los documentos son la bitácora del
   * almacén y esa regla no se rompe por una corrección de captura. Si ya está
   * aplicado no se toca siquiera —movió cosas y deshacerlo es una decisión
   * aparte, de quien mira el kárdex— y se avisa para que nadie crea que se fue
   * con el envío.
   *
   * Lo que sobrevive es el AuditLog, con el resumen de lo que se llevó.
   */
  async remove(id: string): Promise<{
    code: string;
    voucherCode: string | null;
    voucherCancelled: boolean;
  }> {
    return this.transaction(async (tx) => {
      const current = await tx.garmentShipment.findUnique({
        where: { id },
        include: {
          stage: { select: { name: true } },
          workshop: { select: { name: true } },
          document: { select: { id: true, code: true, status: true } },
          lines: {
            select: {
              sentQuantity: true,
              bundles: true,
              returnedQuantity: true,
              scrapQuantity: true,
            },
          },
        },
      });
      if (!current) throw new NotFoundError("el envío", id);

      const sent = sumBundlePieces(
        current.lines.map((l) => ({
          quantity: l.sentQuantity,
          bundles: l.bundles,
        })),
      );

      const returned = current.lines.reduce(
        (sum, l) => sum + l.returnedQuantity + l.scrapQuantity,
        0,
      );

      // Los renglones y sus retornos se van por cascada del esquema.
      await tx.garmentShipment.delete({ where: { id } });

      const voucher = current.document;
      const cancelVoucher = voucher?.status === "DRAFT";

      if (voucher && cancelVoucher) {
        await new DocumentService(this.context, tx).cancel(
          voucher.id,
          `Se eliminó el envío ${current.code}`,
        );
      }

      await this.auditWith(tx).record({
        entity: "GarmentShipment",
        entityId: id,
        action: "DELETE",
        reference: current.code,
        oldValue: {
          etapa: current.stage.name,
          taller: current.workshop.name,
          /* Renglones y no tallas: la misma talla ocupa varios cuando viajó en
             bultos de cuentas distintas, y llamarlo "tallas" haría creer que
             el envío llevaba más de las que llevaba. */
          renglones: current.lines.length,
          piezas: sent,
          retornos: returned,
          vale: voucher?.code ?? null,
        },
        sensitivity: "MEDIUM",
      });

      return {
        code: current.code,
        voucherCode: voucher?.code ?? null,
        voucherCancelled: Boolean(voucher && cancelVoucher),
      };
    });
  }

  /** El tablero de la orden: cuánto se ha mandado de cada talla a cada etapa. */
  async balances(orderId: string): Promise<Map<string, SizeBalance>> {
    const [lines, shipmentLines] = await Promise.all([
      this.db.cuttingOrderLine.findMany({
        where: { orderId },
        select: { sizeId: true, cutQuantity: true },
      }),
      this.db.garmentShipmentLine.findMany({
        where: { shipment: { orderId, status: { not: "CANCELLED" } } },
        select: {
          sizeId: true,
          sentQuantity: true,
          bundles: true,
          returnedQuantity: true,
          scrapQuantity: true,
          shipment: {
            select: { stageId: true, stage: { select: { name: true } } },
          },
        },
      }),
    ]);

    const balances = new Map<string, SizeBalance>();

    for (const line of lines) {
      balances.set(line.sizeId, {
        sizeId: line.sizeId,
        cut: line.cutQuantity,
        byStage: new Map(),
      });
    }

    for (const line of shipmentLines) {
      const balance = balances.get(line.sizeId);
      if (!balance) continue;

      const { stageId, stage } = line.shipment;

      const count = balance.byStage.get(stageId) ?? {
        stageId,
        stageName: stage.name,
        sent: 0,
        returned: 0,
        scrap: 0,
      };

      count.sent += bundlePieces({
        quantity: line.sentQuantity,
        bundles: line.bundles,
      });
      count.returned += line.returnedQuantity;
      count.scrap += line.scrapQuantity;

      balance.byStage.set(stageId, count);
    }

    return balances;
  }

  /**
   * El estado se deriva de los retornos, no se elige a mano.
   *
   * Un envío sin retornos se queda en SENT para siempre, y es lo correcto:
   * significa "salió", no "está pendiente de volver".
   */
  private async syncStatus(tx: PrismaExecutor, shipmentId: string) {
    const lines = await tx.garmentShipmentLine.findMany({
      where: { shipmentId },
      select: {
        sentQuantity: true,
        bundles: true,
        returnedQuantity: true,
        scrapQuantity: true,
      },
    });

    const sent = sumBundlePieces(
      lines.map((l) => ({ quantity: l.sentQuantity, bundles: l.bundles })),
    );
    const back = lines.reduce(
      (sum, l) => sum + l.returnedQuantity + l.scrapQuantity,
      0,
    );

    const status = back === 0 ? "SENT" : back >= sent ? "CLOSED" : "PARTIAL";

    await tx.garmentShipment.update({
      where: { id: shipmentId },
      data: { status, closedAt: status === "CLOSED" ? new Date() : null },
    });
  }
}
