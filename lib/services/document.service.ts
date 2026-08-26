import type { DocumentType, InventoryDocument, MovementType } from "@prisma/client";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import type { DocumentInput } from "@/lib/validations/document.schema";
import { BaseService } from "./base.service";
import { InventoryService } from "./inventory.service";

/**
 * Qué movimiento genera cada tipo de documento.
 *
 * Agregar un tipo de documento nuevo = agregar una entrada aquí. El Record
 * exige la clave completa, así que si el schema gana un DocumentType y falta
 * su movimiento, el compilador lo marca.
 */
const MOVEMENT_BY_DOCUMENT: Record<DocumentType, MovementType> = {
  RECEIPT: "RECEIPT_PURCHASE",
  ISSUE: "ISSUE_PRODUCTION",
  TRANSFER: "RECLASSIFICATION",
  ADJUSTMENT: "RECEIPT_ADJUSTMENT",
  PRODUCTION_RETURN: "RECEIPT_PRODUCTION_RETURN",
  SUPPLIER_RETURN: "ISSUE_SUPPLIER_RETURN",
  WRITE_OFF: "ISSUE_WRITE_OFF",
  COUNT: "RECOUNT",
};

/** El movimiento que revierte a cada uno, para las cancelaciones. */
const REVERSAL_MOVEMENT: Record<MovementType, MovementType> = {
  RECEIPT_PURCHASE: "ISSUE_ADJUSTMENT",
  RECEIPT_PRODUCTION_RETURN: "ISSUE_ADJUSTMENT",
  RECEIPT_ADJUSTMENT: "ISSUE_ADJUSTMENT",
  RECEIPT_TRANSFER: "ISSUE_TRANSFER",
  RECEIPT_INITIAL: "ISSUE_ADJUSTMENT",
  ISSUE_PRODUCTION: "RECEIPT_ADJUSTMENT",
  ISSUE_SAMPLE: "RECEIPT_ADJUSTMENT",
  ISSUE_SCRAP: "RECEIPT_ADJUSTMENT",
  ISSUE_SUPPLIER_RETURN: "RECEIPT_ADJUSTMENT",
  ISSUE_ADJUSTMENT: "RECEIPT_ADJUSTMENT",
  ISSUE_TRANSFER: "RECEIPT_TRANSFER",
  ISSUE_WRITE_OFF: "RECEIPT_ADJUSTMENT",
  RECLASSIFICATION: "RECLASSIFICATION",
  RECOUNT: "RECOUNT",
};

const SERIES_BY_TYPE: Record<DocumentType, { key: string; prefix: string }> = {
  RECEIPT: { key: "INBOUND", prefix: "IN" },
  PRODUCTION_RETURN: { key: "INBOUND", prefix: "IN" },
  ADJUSTMENT: { key: "INBOUND", prefix: "IN" },
  ISSUE: { key: "OUTBOUND", prefix: "OUT" },
  SUPPLIER_RETURN: { key: "OUTBOUND", prefix: "OUT" },
  WRITE_OFF: { key: "OUTBOUND", prefix: "OUT" },
  TRANSFER: { key: "OUTBOUND", prefix: "OUT" },
  COUNT: { key: "OUTBOUND", prefix: "OUT" },
};

/**
 * Documentos de inventario: el vale que se firma en el andén.
 *
 * La regla que sostiene todo: un documento en DRAFT **no afecta existencias**.
 * Se puede editar, corregir y borrar sin consecuencias. Sólo al APLICARLO se
 * generan los movimientos, y a partir de ahí ya no se toca: cancelarlo genera
 * movimientos inversos, nunca borra los originales.
 */
export class DocumentService extends BaseService {
  private get inventory(): InventoryService {
    return new InventoryService(this.context);
  }

  async create(input: DocumentInput): Promise<InventoryDocument> {
    return this.transaction(async (tx) => {
      const series = SERIES_BY_TYPE[input.type];
      const code = await this.sequencesWith(tx).next(series.key, series.prefix, 4);

      const document = await tx.inventoryDocument.create({
        data: {
          code,
          type: input.type,
          date: input.date ?? new Date(),
          // Nace en borrador SIEMPRE: aplicar es un acto aparte y deliberado.
          status: "DRAFT",
          clientId: input.clientId,
          productionRunId: input.productionRunId,
          concept: input.concept,
          reference: input.reference,
          handedOverBy: input.handedOverBy,
          receivedBy: input.receivedBy,
          notes: input.notes,
          ...cutHeaderData(input),
          createdById: this.context.userId,
          lines: {
            create: input.lines.map((line, index) => ({
              lotId: line.lotId,
              quantity: line.quantity,
              unit: line.unit,
              fromLocationId: line.fromLocationId,
              toLocationId: line.toLocationId,
              notes: line.notes,
              order: index,
            })),
          },
          // La tabla de corte: prendas por talla. No mueve inventario, es el
          // desglose que firma el taller junto al vale.
          cutLines: {
            create: (input.cutLines ?? []).map((line, index) => ({
              sizeId: line.sizeId,
              quantity: line.quantity,
              bundles: line.bundles,
              tagId: line.tagId,
              notes: line.notes,
              order: index,
            })),
          },
        },
      });

      await this.auditWith(tx).record({
        entity: "InventoryDocument",
        entityId: document.id,
        action: "CREATE",
        reference: code,
        newValue: { code, type: input.type, lines: input.lines.length },
        sensitivity: "LOW",
      });

      return document;
    });
  }

  /**
   * Copia un documento —en el estado que sea— a un BORRADOR nuevo.
   *
   * Nace de la realidad del taller: dos cortes de la misma prenda salen casi
   * iguales, y volver a teclear diez renglones de tallas a mano es el camino
   * más corto a un error de captura. Se copia el vale completo y el auxiliar
   * corrige sólo lo que cambia.
   *
   * NO copia nada que pertenezca al original y no a la copia: folio, estado,
   * quién aplicó, quién canceló y su motivo se generan de cero. La copia nace
   * en DRAFT aunque el original ya esté aplicado, así que no mueve una sola
   * existencia hasta que alguien la aplique a propósito.
   */
  async duplicate(id: string): Promise<InventoryDocument> {
    return this.transaction(async (tx) => {
      const source = await tx.inventoryDocument.findUnique({
        where: { id },
        include: {
          lines: { orderBy: { order: "asc" } },
          cutLines: { orderBy: { order: "asc" } },
        },
      });

      if (!source) throw new NotFoundError("el documento", id);

      const series = SERIES_BY_TYPE[source.type];
      const code = await this.sequencesWith(tx).next(series.key, series.prefix, 4);

      const copy = await tx.inventoryDocument.create({
        data: {
          code,
          type: source.type,
          // Hoy, no la del original: la copia es un vale de esta salida, y
          // heredar una fecha vieja la mandaría al periodo equivocado.
          date: new Date(),
          status: "DRAFT",
          clientId: source.clientId,
          productionRunId: source.productionRunId,
          concept: source.concept,
          reference: source.reference,
          handedOverBy: source.handedOverBy,
          receivedBy: source.receivedBy,
          notes: source.notes,
          cutDescription: source.cutDescription,
          cutFabricId: source.cutFabricId,
          cutFabricText: source.cutFabricText,
          cutPattern: source.cutPattern,
          cutVersion: source.cutVersion,
          cutVersionNotes: source.cutVersionNotes,
          cutNotes: source.cutNotes,
          createdById: this.context.userId,
          lines: {
            create: source.lines.map((line, index) => ({
              lotId: line.lotId,
              quantity: line.quantity,
              unit: line.unit,
              fromLocationId: line.fromLocationId,
              toLocationId: line.toLocationId,
              notes: line.notes,
              order: index,
            })),
          },
          cutLines: {
            create: source.cutLines.map((line, index) => ({
              sizeId: line.sizeId,
              quantity: line.quantity,
              bundles: line.bundles,
              tagId: line.tagId,
              notes: line.notes,
              order: index,
            })),
          },
        },
      });

      await this.auditWith(tx).record({
        entity: "InventoryDocument",
        entityId: copy.id,
        action: "CREATE",
        reference: code,
        newValue: {
          code,
          type: source.type,
          lines: source.lines.length,
          cutLines: source.cutLines.length,
          // Deja el rastro de de dónde salió: si la copia sale mal, se puede
          // ir al original a ver qué se cambió.
          duplicatedFrom: source.code,
        },
        sensitivity: "LOW",
      });

      return copy;
    });
  }

  /** Sólo se puede editar mientras esté en borrador. */
  async update(id: string, input: DocumentInput): Promise<InventoryDocument> {
    return this.transaction(async (tx) => {
      const current = await tx.inventoryDocument.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("el documento", id);

      if (current.status !== "DRAFT") {
        throw new BusinessRuleError(
          `El documento ${current.code} ya fue aplicado y no se puede editar. Cancélalo y genera uno nuevo.`,
        );
      }

      await tx.documentLine.deleteMany({ where: { documentId: id } });
      await tx.documentCutLine.deleteMany({ where: { documentId: id } });

      const document = await tx.inventoryDocument.update({
        where: { id },
        data: {
          date: input.date ?? current.date,
          clientId: input.clientId,
          productionRunId: input.productionRunId,
          concept: input.concept,
          reference: input.reference,
          handedOverBy: input.handedOverBy,
          receivedBy: input.receivedBy,
          notes: input.notes,
          ...cutHeaderData(input),
          lines: {
            create: input.lines.map((line, index) => ({
              lotId: line.lotId,
              quantity: line.quantity,
              unit: line.unit,
              fromLocationId: line.fromLocationId,
              toLocationId: line.toLocationId,
              notes: line.notes,
              order: index,
            })),
          },
          cutLines: {
            create: (input.cutLines ?? []).map((line, index) => ({
              sizeId: line.sizeId,
              quantity: line.quantity,
              bundles: line.bundles,
              tagId: line.tagId,
              notes: line.notes,
              order: index,
            })),
          },
        },
      });

      await this.auditWith(tx).record({
        entity: "InventoryDocument",
        entityId: id,
        action: "UPDATE",
        reference: current.code,
        oldValue: { lines: "reemplazados" },
        newValue: { lines: input.lines.length },
        sensitivity: "MEDIUM",
      });

      return document;
    });
  }

  /**
   * APLICA el documento: aquí sí se mueve el inventario.
   *
   * Los renglones se aplican dentro de UNA sola transacción: si el renglón 18
   * de 20 falla por falta de existencia, se revierten los 17 anteriores. Un
   * documento a medias sería peor que uno rechazado, porque nadie sabría
   * cuánto alcanzó a salir.
   */
  async apply(id: string): Promise<InventoryDocument> {
    return this.transaction(async (tx) => {
      const document = await tx.inventoryDocument.findUnique({
        where: { id },
        include: { lines: { orderBy: { order: "asc" } } },
      });

      if (!document) throw new NotFoundError("el documento", id);

      if (document.status !== "DRAFT") {
        throw new BusinessRuleError(
          `El documento ${document.code} ya está ${document.status === "APPLIED" ? "aplicado" : "cancelado"}.`,
        );
      }

      /* Una SALIDA puede no tener rollos: cuando lleva sólo el desglose de
         cortes no hay tela que descontar, y aplicarla sirve para marcarla como
         entregada —con su fecha y quién la aplicó— en vez de dejarla en
         borrador para siempre. Genera cero movimientos, que es lo correcto:
         el kárdex sólo registra lo que de verdad se movió.

         Los demás tipos existen para mover rollos, así que sin renglones no
         significan nada y se siguen rechazando. */
      if (document.lines.length === 0) {
        const cutCount = await tx.documentCutLine.count({
          where: { documentId: id },
        });

        if (document.type !== "ISSUE" || cutCount === 0) {
          throw new BusinessRuleError(
            "El documento no tiene renglones. Agrega al menos uno antes de aplicarlo.",
          );
        }
      }

      const movementType = MOVEMENT_BY_DOCUMENT[document.type];

      for (const line of document.lines) {
        await this.inventory.applyMovementWithin(tx, {
          lotId: line.lotId,
          type: movementType,
          quantity: Number(line.quantity),
          documentId: document.id,
          productionRunId: document.productionRunId ?? undefined,
          fromLocationId: line.fromLocationId ?? undefined,
          toLocationId: line.toLocationId ?? undefined,
          reason: document.concept ?? undefined,
        });
      }

      const applied = await tx.inventoryDocument.update({
        where: { id },
        data: {
          status: "APPLIED",
          appliedById: this.context.userId,
          appliedAt: new Date(),
        },
      });

      await this.auditWith(tx).record({
        entity: "InventoryDocument",
        entityId: id,
        action: "APPLY",
        reference: document.code,
        oldValue: { status: "DRAFT" },
        newValue: { status: "APPLIED", lines: document.lines.length },
        sensitivity: "HIGH",
        reason: `Aplicación del documento ${document.code}`,
      });

      return applied;
    });
  }

  /**
   * Cancela un documento aplicado generando movimientos INVERSOS.
   *
   * Nunca se borran los movimientos originales: el kárdex es append-only.
   * Después de cancelar quedan los dos asientos —el original y su reverso—,
   * que es justo lo que permite auditar qué pasó y cuándo.
   */
  async cancel(id: string, reason: string): Promise<InventoryDocument> {
    return this.transaction(async (tx) => {
      const document = await tx.inventoryDocument.findUnique({
        where: { id },
        include: { movements: { orderBy: { createdAt: "asc" } } },
      });

      if (!document) throw new NotFoundError("el documento", id);

      if (document.status === "CANCELLED") {
        throw new BusinessRuleError(`El documento ${document.code} ya está cancelado.`);
      }

      // Un borrador nunca movió nada: basta con marcarlo.
      if (document.status === "DRAFT") {
        const cancelled = await tx.inventoryDocument.update({
          where: { id },
          data: {
            status: "CANCELLED",
            cancelledById: this.context.userId,
            cancelledAt: new Date(),
            cancellationReason: reason,
          },
        });

        await this.auditWith(tx).record({
          entity: "InventoryDocument",
          entityId: id,
          action: "CANCEL",
          reference: document.code,
          oldValue: { status: "DRAFT" },
          newValue: { status: "CANCELLED" },
          sensitivity: "MEDIUM",
          reason,
        });

        return cancelled;
      }

      for (const movement of document.movements) {
        // Ya revertido antes: no se duplica el reverso.
        if (movement.reversesId) continue;

        await this.inventory.applyMovementWithin(tx, {
          lotId: movement.lotId,
          type: REVERSAL_MOVEMENT[movement.type],
          quantity: Math.abs(Number(movement.quantity)),
          documentId: document.id,
          // Deja el rastro de qué asiento revierte este.
          reversesId: movement.id,
          reason: `Cancelación de ${document.code}: ${reason}`,
        });
      }

      const cancelled = await tx.inventoryDocument.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledById: this.context.userId,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      await this.auditWith(tx).record({
        entity: "InventoryDocument",
        entityId: id,
        action: "CANCEL",
        reference: document.code,
        oldValue: { status: "APPLIED" },
        newValue: { status: "CANCELLED", reversed: document.movements.length },
        sensitivity: "CRITICAL",
        reason,
      });

      return cancelled;
    });
  }
}

/**
 * El encabezado del desglose de corte, listo para Prisma.
 *
 * Se extrae aquí porque `create` y `update` guardan exactamente los mismos
 * campos: tenerlos escritos dos veces garantizaba que un día alguien agregara
 * uno en el alta y se le olvidara en la corrección, y el dato desaparecería al
 * editar el borrador.
 */
function cutHeaderData(input: DocumentInput) {
  return {
    cutDescription: input.cutDescription,
    cutFabricId: input.cutFabricId,
    cutFabricText: input.cutFabricText,
    cutPattern: input.cutPattern,
    cutVersion: input.cutVersion,
    cutVersionNotes: input.cutVersionNotes,
    cutNotes: input.cutNotes ?? [],
  };
}
