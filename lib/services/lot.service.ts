import type { Lot, Movement } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import { LotRepository } from "@/lib/repositories/lot.repository";
import type {
  CancelLotInput,
  CreateLotInput,
  CutLotInput,
  RecountLotInput,
  TransferLotInput,
  UpdateLotInput,
} from "@/lib/validations/lot.schema";
import { BaseService } from "./base.service";
import { InventoryService, round4 } from "./inventory.service";

export interface RecountResult {
  lot: Lot;
  difference: number;
  movement: Movement | null;
}

/**
 * Reglas del rollo.
 *
 * Todo lo que toque el saldo pasa por InventoryService. Este servicio decide
 * QUÉ movimiento corresponde y con qué motivo; el cómo —bloquear la fila,
 * calcular el saldo, escribir el kárdex— es de aquél.
 */
export class LotService extends BaseService {
  private get inventory(): InventoryService {
    return new InventoryService(this.context);
  }

  /**
   * Alta de rollo.
   *
   * El lote nace con `currentQuantity = 0` y el saldo llega por un movimiento
   * RECEIPT_INITIAL, no por una escritura directa.
   *
   * Podría parecer un rodeo —crear en 0 para luego sumar— pero es lo que hace
   * que el kárdex esté completo desde el primer día: el saldo de un rollo es
   * SIEMPRE la suma de sus movimientos, sin un valor inicial que nadie
   * justifica. Es la invariante que verifica scripts/verify-integrity.ts.
   */
  async create(input: CreateLotInput): Promise<Lot> {
    return this.transaction(async (tx) => {
      const code = await this.sequencesWith(tx).next("LOT", "R", 5);

      const created = await tx.lot.create({
        data: {
          code,
          materialId: input.materialId,
          clientId: input.clientId,
          locationId: input.locationId,
          receiptId: input.receiptId,
          productionRunId: input.productionRunId,

          unit: input.unit,
          initialQuantity: input.quantity,
          // Nace en cero a propósito: el saldo lo pone el movimiento.
          currentQuantity: 0,

          supplierLotNumber: input.supplierLotNumber,
          shade: input.shade,
          colorText: input.colorText,
          productionNote: input.productionNote,
          actualWidthMm: input.actualWidthMm,
          actualThicknessMm: input.actualThicknessMm,
          actualWeightOz: input.actualWeightOz,
          weightKg: input.weightKg,

          measurementSource: input.measurementSource,
          verified: input.verified,
          verifiedAt: input.verified ? new Date() : null,

          unitCost: input.unitCost,
          currency: input.currency,
          receivedAt: input.receivedAt ?? new Date(),
          comment: input.comment,
          createdById: this.context.userId,
        },
      });

      await this.inventory.applyMovementWithin(tx, {
        lotId: created.id,
        type: "RECEIPT_INITIAL",
        quantity: input.quantity,
        toLocationId: input.locationId,
        unitCost: input.unitCost,
      });

      await this.auditWith(tx).record({
        entity: "Lot",
        entityId: created.id,
        action: "CREATE",
        reference: code,
        newValue: { code, materialId: input.materialId, quantity: input.quantity },
        sensitivity: "LOW",
      });

      // Se relee para devolver el saldo ya aplicado por el movimiento.
      return tx.lot.findUniqueOrThrow({ where: { id: created.id } });
    });
  }

  /**
   * Edición de la ficha: corregir el error de dedo.
   *
   * NO toca cantidades ni fecha de llegada ni estado: eso lo fija el esquema,
   * que sólo deja pasar los campos descriptivos. El saldo se escribe
   * únicamente dentro de InventoryService, y `receivedAt` es un hecho
   * histórico —el material entró ese día— que no se reescribe.
   */
  async update(input: UpdateLotInput): Promise<Lot> {
    return this.transaction(async (tx) => {
      const repository = new LotRepository(tx);
      const before = await repository.findByIdOrThrow(input.id);

      const lot = await tx.lot.update({
        where: { id: input.id },
        data: {
          clientId: input.clientId,
          locationId: input.locationId,
          supplierLotNumber: input.supplierLotNumber,
          shade: input.shade,
          colorText: input.colorText,
          productionNote: input.productionNote,
          actualWidthMm: input.actualWidthMm,
          actualThicknessMm: input.actualThicknessMm,
          actualWeightOz: input.actualWeightOz,
          weightKg: input.weightKg,
          unitCost: input.unitCost,
          expiresAt: input.expiresAt,
          comment: input.comment,
        },
      });

      /* Se auditan SÓLO los campos editables y no el registro completo: si se
         mandara `before` y `lot` enteros, `changedFields` incluiría updatedAt
         en cada corrección y la bitácora diría que cambió algo que el usuario
         nunca tocó. Con esto, quien revise ve exactamente qué se corrigió. */
      await this.auditWith(tx).record({
        entity: "Lot",
        entityId: lot.id,
        action: "UPDATE",
        reference: lot.code,
        oldValue: pickEditable(before),
        newValue: pickEditable(lot),
        sensitivity: "MEDIUM",
        reason: input.reason,
      });

      return lot;
    });
  }

  /**
   * Corte: se toma un tramo del rollo y se surte a producción.
   *
   * Es la operación más frecuente del piso y debe lograrse en 2 toques desde
   * la ficha del rollo.
   */
  async cut(input: CutLotInput): Promise<Movement> {
    return this.transaction(async (tx) => {
      const lot = await this.requireLot(tx, input.lotId);

      const movement = await this.inventory.applyMovementWithin(tx, {
        lotId: input.lotId,
        type: "ISSUE_PRODUCTION",
        quantity: input.quantity,
        productionRunId: input.productionRunId,
        toLocationId: input.toLocationId,
        reason: input.reason,
      });

      await this.auditWith(tx).record({
        entity: "Lot",
        entityId: input.lotId,
        action: "UPDATE",
        reference: movement.code,
        oldValue: { currentQuantity: lot.currentQuantity },
        newValue: { currentQuantity: movement.balanceAfter },
        sensitivity: "MEDIUM",
        reason: input.reason,
      });

      return movement;
    });
  }

  /**
   * Reconteo: lo que de verdad hay contra lo que dice el sistema.
   *
   * La diferencia NO se escribe sobre el saldo: se genera el movimiento de
   * ajuste que la explica, para que el kárdex siga cuadrando y quede el
   * rastro de quién la ajustó y por qué.
   */
  async recount(input: RecountLotInput): Promise<RecountResult> {
    return this.transaction(async (tx) => {
      const lot = await this.requireLot(tx, input.lotId);

      const current = round4(Number(lot.currentQuantity));
      const counted = round4(input.countedQuantity);
      const difference = round4(counted - current);

      // Coincide con el sistema: no hay nada que ajustar, sólo se deja
      // constancia de que alguien fue a medirlo con cinta.
      if (difference === 0) {
        const verified = await tx.lot.update({
          where: { id: lot.id },
          data: {
            verified: true,
            verifiedAt: new Date(),
            measurementSource: input.measurementSource,
          },
        });

        await this.auditWith(tx).record({
          entity: "Lot",
          entityId: lot.id,
          action: "UPDATE",
          reference: lot.code,
          oldValue: { verified: lot.verified, currentQuantity: current },
          newValue: { verified: true, currentQuantity: counted },
          sensitivity: "MEDIUM",
          reason: input.reason,
        });

        return { lot: verified, difference: 0, movement: null };
      }

      // Sobró material → entra; faltó → sale. El tipo lo decide el signo.
      const movement = await this.inventory.applyMovementWithin(tx, {
        lotId: lot.id,
        type: difference > 0 ? "RECEIPT_ADJUSTMENT" : "ISSUE_ADJUSTMENT",
        quantity: Math.abs(difference),
        reason: input.reason,
      });

      const verified = await tx.lot.update({
        where: { id: lot.id },
        data: {
          verified: true,
          verifiedAt: new Date(),
          measurementSource: input.measurementSource,
        },
      });

      // HIGH con motivo obligatorio: un ajuste de cantidad sin explicación es
      // inútil seis meses después, cuando alguien pregunte por los 40 metros.
      await this.auditWith(tx).record({
        entity: "Lot",
        entityId: lot.id,
        action: "UPDATE",
        reference: movement.code,
        oldValue: { currentQuantity: current, verified: lot.verified },
        newValue: { currentQuantity: counted, verified: true },
        sensitivity: "HIGH",
        reason: input.reason,
      });

      return { lot: verified, difference, movement };
    });
  }

  /**
   * Traspaso entre ubicaciones.
   *
   * Movimiento RECLASSIFICATION con cantidad 0: cambia de lugar, no de saldo.
   * Queda en el kárdex para poder rastrear por dónde ha pasado el rollo.
   */
  async transfer(input: TransferLotInput): Promise<Movement> {
    return this.transaction(async (tx) => {
      const lot = await this.requireLot(tx, input.lotId);

      if (lot.locationId === input.toLocationId) {
        throw new BusinessRuleError(
          "El rollo ya está en esa ubicación.",
          "toLocationId",
        );
      }

      const movement = await this.inventory.applyMovementWithin(tx, {
        lotId: lot.id,
        type: "RECLASSIFICATION",
        // La estrategia NEUTRAL lo convierte en 0; se manda 1 sólo para
        // pasar la validación de "cantidad mayor que cero".
        quantity: 1,
        fromLocationId: lot.locationId ?? undefined,
        toLocationId: input.toLocationId,
        reason: input.reason,
      });

      await this.auditWith(tx).record({
        entity: "Lot",
        entityId: lot.id,
        action: "UPDATE",
        reference: movement.code,
        oldValue: { locationId: lot.locationId },
        newValue: { locationId: input.toLocationId },
        sensitivity: "LOW",
        reason: input.reason,
      });

      return movement;
    });
  }

  /**
   * Cancelación (baja) de un rollo.
   *
   * Soft delete de verdad: el registro NO se borra ni se le pone `deletedAt`
   * —la tabla no tiene esa columna a propósito—, pasa a WRITTEN_OFF y sigue
   * ahí con su historial completo y el motivo a la vista.
   *
   * Lo que queda del saldo se descarga con un ISSUE_ADJUSTMENT, no con un
   * `currentQuantity = 0`. Es la regla sagrada: si escribiéramos el saldo a
   * mano, el rollo diría 0 pero la suma de sus movimientos diría 300, y
   * verify-integrity.ts marcaría la fila como corrupta para siempre.
   *
   * El motivo se guarda en `blockReason` (el campo que ya existe para
   * explicar por qué un rollo no se puede tomar) y además queda en el
   * movimiento y en la bitácora.
   */
  async cancel(input: CancelLotInput): Promise<Lot> {
    return this.transaction(async (tx) => {
      const lot = await this.requireLot(tx, input.id);

      if (lot.status === "WRITTEN_OFF") {
        throw new BusinessRuleError("Este rollo ya está cancelado.");
      }

      // Con material reservado hay una salida comprometida contra este rollo:
      // cancelarlo dejaría esa reserva apuntando a algo que ya no existe.
      const reserved = round4(Number(lot.reservedQuantity));
      if (reserved > 0) {
        throw new BusinessRuleError(
          `El rollo tiene ${reserved} reservados. Libera la reserva antes de cancelarlo.`,
        );
      }

      // Sólo si queda saldo: un rollo ya agotado se cancela sin movimiento,
      // porque no hay nada que descargar.
      const remaining = round4(Number(lot.currentQuantity));
      if (remaining > 0) {
        await this.inventory.applyMovementWithin(tx, {
          lotId: lot.id,
          type: "ISSUE_ADJUSTMENT",
          quantity: remaining,
          reason: input.reason,
        });
      }

      const cancelled = await tx.lot.update({
        where: { id: lot.id },
        data: {
          status: "WRITTEN_OFF",
          isBlocked: true,
          blockReason: input.reason,
        },
      });

      // CRITICAL: es la acción más destructiva sobre un rollo. Sale destacada
      // en el tablero de auditoría junto con quién la hizo y desde dónde.
      await this.auditWith(tx).record({
        entity: "Lot",
        entityId: lot.id,
        action: "CANCEL",
        reference: lot.code,
        oldValue: { status: lot.status, currentQuantity: remaining },
        newValue: { status: "WRITTEN_OFF", currentQuantity: 0 },
        sensitivity: "CRITICAL",
        reason: input.reason,
      });

      return cancelled;
    });
  }

  private async requireLot(tx: PrismaExecutor, lotId: string): Promise<Lot> {
    const lot = await tx.lot.findUnique({ where: { id: lotId } });
    if (!lot) throw new NotFoundError("el rollo", lotId);
    return lot;
  }
}

/**
 * Los campos que la edición puede tocar.
 *
 * Se usa para acotar lo que se manda a la bitácora: comparar el registro
 * completo metería `updatedAt` en `changedFields` de cada corrección, y quien
 * audite no sabría distinguir lo que el usuario cambió de lo que cambió solo.
 */
function pickEditable(lot: Lot): Record<string, unknown> {
  return {
    clientId: lot.clientId,
    locationId: lot.locationId,
    supplierLotNumber: lot.supplierLotNumber,
    shade: lot.shade,
    colorText: lot.colorText,
    productionNote: lot.productionNote,
    actualWidthMm: lot.actualWidthMm,
    actualThicknessMm: lot.actualThicknessMm,
    actualWeightOz: lot.actualWeightOz,
    weightKg: lot.weightKg,
    unitCost: lot.unitCost,
    expiresAt: lot.expiresAt,
    comment: lot.comment,
  };
}
