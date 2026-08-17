import type {
  Lot,
  Material,
  Movement,
  MovementDirection,
  MovementType,
  Prisma,
} from "@prisma/client";
import { isRemnantEligible } from "@/lib/constants/lot-status";
import { prisma, type PrismaExecutor, type PrismaTransaction } from "@/lib/prisma";
import { AuditService, type AuditContext } from "@/lib/core/audit.service";
import {
  BusinessRuleError,
  InsufficientStockError,
  NotFoundError,
} from "@/lib/core/errors";
import { SequenceService } from "@/lib/core/sequence.service";

/**
 * Redondeo a 4 decimales.
 *
 * La base guarda Decimal(14,4). Si aquí se opera con más precisión, el saldo
 * calculado y el guardado se separan poco a poco y el kárdex deja de cuadrar.
 */
export function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Tiempos de transacción.
 *
 * Los 5 s de Prisma se quedan cortos: cuando varios cortes caen sobre el
 * mismo rollo, el FOR UPDATE los forma en fila y los últimos esperan su
 * turno. Con el default, en vez de esperar, reventaban por timeout.
 * `maxWait` es lo que aguarda para obtener conexión del pool de Neon.
 */
const TRANSACTION_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;

// ═══════════════════════════════════════════════════════════════════════════
//  STRATEGY — cada tipo de movimiento sabe su dirección y sus validaciones
// ═══════════════════════════════════════════════════════════════════════════

export interface LotWithMaterial extends Lot {
  material: Material;
}

/**
 * POLIMORFISMO: InventoryService no pregunta de qué tipo es el movimiento.
 * Le pide a la estrategia su dirección, su signo y que valide, y cada
 * subclase responde a su manera.
 */
export abstract class MovementStrategy {
  abstract readonly direction: MovementDirection;

  /** Convierte la cantidad capturada (siempre positiva) en su signo real. */
  abstract signedQuantity(quantity: number): number;

  /**
   * Validaciones comunes a todo movimiento. Las subclases que necesiten más
   * llaman a `super.validate()` y agregan las suyas.
   */
  validate(lot: LotWithMaterial, quantity: number): void {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BusinessRuleError(
        "La cantidad debe ser mayor que cero.",
        "quantity",
      );
    }

    // Un rollo bloqueado está retenido por calidad o por una disputa: no se
    // mueve hasta que alguien lo libere a propósito.
    if (lot.isBlocked) {
      const reason = lot.blockReason ? ` Motivo: ${lot.blockReason}` : "";
      throw new BusinessRuleError(
        `El rollo ${lot.code} está bloqueado y no puede moverse.${reason}`,
      );
    }
  }
}

/** Entradas: suman al saldo. */
export class InboundStrategy extends MovementStrategy {
  readonly direction: MovementDirection = "IN";

  signedQuantity(quantity: number): number {
    return round4(quantity);
  }
}

/** Salidas: restan del saldo y no pueden dejarlo en negativo. */
export class OutboundStrategy extends MovementStrategy {
  readonly direction: MovementDirection = "OUT";

  signedQuantity(quantity: number): number {
    return round4(-quantity);
  }

  override validate(lot: LotWithMaterial, quantity: number): void {
    super.validate(lot, quantity);

    const current = Number(lot.currentQuantity);
    const reserved = Number(lot.reservedQuantity);
    // Lo que de verdad se puede tomar: el resto está apartado para otra orden.
    const available = round4(current - reserved);

    if (quantity > current) {
      throw new InsufficientStockError(
        quantity,
        current,
        lot.unit,
        lot.code,
      );
    }

    // Hay tela física, pero está comprometida. Es un caso distinto de "no
    // hay": se resuelve liberando la reserva, no comprando más.
    if (quantity > available) {
      throw new BusinessRuleError(
        `El rollo ${lot.code} tiene ${current} ${lot.unit} pero ${reserved} están reservados: sólo puedes disponer de ${available}.`,
        "quantity",
      );
    }
  }
}

/**
 * Traspasos y reclasificaciones: mueven el rollo de lugar o cambian su
 * clasificación, pero el saldo no se toca.
 */
export class NeutralStrategy extends MovementStrategy {
  readonly direction: MovementDirection = "NEUTRAL";

  signedQuantity(): number {
    return 0;
  }
}

const INBOUND = new InboundStrategy();
const OUTBOUND = new OutboundStrategy();
const NEUTRAL = new NeutralStrategy();

/**
 * El mapa de estrategias.
 *
 * Agregar un tipo de movimiento nuevo = agregar UNA entrada aquí. No se toca
 * InventoryService: ése es justo el punto del patrón Strategy. El Record
 * exige la clave completa, así que si mañana el schema gana un MovementType
 * y aquí falta, el compilador lo marca.
 */
export const MOVEMENT_STRATEGIES: Record<MovementType, MovementStrategy> = {
  // ── Entradas ──
  RECEIPT_PURCHASE: INBOUND,
  RECEIPT_PRODUCTION_RETURN: INBOUND,
  RECEIPT_ADJUSTMENT: INBOUND,
  RECEIPT_TRANSFER: INBOUND,
  RECEIPT_INITIAL: INBOUND,

  // ── Salidas ──
  ISSUE_PRODUCTION: OUTBOUND,
  ISSUE_SAMPLE: OUTBOUND,
  ISSUE_SCRAP: OUTBOUND,
  ISSUE_SUPPLIER_RETURN: OUTBOUND,
  ISSUE_ADJUSTMENT: OUTBOUND,
  ISSUE_TRANSFER: OUTBOUND,
  ISSUE_WRITE_OFF: OUTBOUND,

  // ── Sin efecto en el saldo ──
  RECLASSIFICATION: NEUTRAL,
  RECOUNT: NEUTRAL,
};

// ═══════════════════════════════════════════════════════════════════════════
//  FACADE — la única puerta para mover existencias
// ═══════════════════════════════════════════════════════════════════════════

export interface MovementRequest {
  lotId: string;
  type: MovementType;
  /** Siempre POSITIVA. El signo lo pone la estrategia. */
  quantity: number;
  reason?: string;
  documentId?: string;
  productionRunId?: string;
  fromLocationId?: string;
  /** Si viene, el rollo queda en esta ubicación al terminar. */
  toLocationId?: string;
  unitCost?: number;
  /** Movimiento que este revierte, en una cancelación. */
  reversesId?: string;
}

/**
 * FACADE: la ÚNICA puerta de entrada para mover stock.
 *
 * `Lot.currentQuantity` se escribe aquí dentro y en ningún otro lugar del
 * sistema, siempre en la misma transacción que crea su Movement. Si algún día
 * los saldos no cuadran con el kárdex, es porque alguien escribió esa columna
 * fuera de esta clase.
 */
export class InventoryService {
  private readonly context: AuditContext;

  constructor(context: AuditContext = {}) {
    this.context = context;
  }

  /**
   * Aplica un movimiento en su propia transacción.
   *
   * Para un solo corte desde el celular. Si se van a aplicar los 20 renglones
   * de un documento, usa applyMovementWithin dentro de UNA transacción: así
   * el documento se aplica completo o no se aplica.
   */
  async applyMovement(request: MovementRequest): Promise<Movement> {
    return prisma.$transaction(
      async (tx) => this.applyMovementWithin(tx, request),
      TRANSACTION_OPTIONS,
    );
  }

  /**
   * El movimiento propiamente dicho, dentro de una transacción ya abierta.
   *
   * El orden de los pasos NO es negociable: bloquear, validar, calcular,
   * registrar, actualizar.
   */
  async applyMovementWithin(
    tx: PrismaTransaction,
    request: MovementRequest,
  ): Promise<Movement> {
    // a. Bloquear la fila ANTES de leer el saldo.
    const lot = await this.lockLot(tx, request.lotId);

    const strategy = MOVEMENT_STRATEGIES[request.type];
    if (!strategy) {
      throw new BusinessRuleError(
        `Tipo de movimiento no reconocido: ${request.type}.`,
      );
    }

    // b. Que la estrategia diga si esto se puede hacer.
    strategy.validate(lot, request.quantity);

    // c y d. El saldo se calcula a partir de lo que se acaba de leer bajo
    // bloqueo, nunca de un valor traído antes de la transacción.
    const balanceBefore = round4(Number(lot.currentQuantity));
    const delta = strategy.signedQuantity(request.quantity);
    const balanceAfter = round4(balanceBefore + delta);

    // e. El folio se aparta dentro de la misma transacción: si esto se
    //    revierte, el consecutivo se revierte con él.
    const code = await new SequenceService(tx).next("MOVEMENT", "MOV", 7);

    // f. El kárdex. Es append-only: nunca se actualiza ni se borra.
    const movement = await tx.movement.create({
      data: {
        code,
        lotId: lot.id,
        materialId: lot.materialId,
        type: request.type,
        direction: strategy.direction,
        quantity: delta,
        unit: lot.unit,
        balanceBefore,
        balanceAfter,
        documentId: request.documentId,
        productionRunId: request.productionRunId,
        fromLocationId: request.fromLocationId ?? lot.locationId,
        toLocationId: request.toLocationId,
        unitCost: request.unitCost,
        reason: request.reason,
        reversesId: request.reversesId,
        userId: this.context.userId,
        userName: this.context.userName,
        source: this.context.source,
      },
    });

    // g y h. El saldo y el estado, en la MISMA transacción que el movimiento.
    const { status, isRemnant } = this.resolveStatus(lot, balanceAfter);

    const data: Prisma.LotUpdateInput = {
      currentQuantity: balanceAfter,
      status,
      isRemnant,
    };

    // Un traspaso deja el rollo en su nueva ubicación.
    if (request.toLocationId) {
      data.location = { connect: { id: request.toLocationId } };
    }

    await tx.lot.update({ where: { id: lot.id }, data });

    return movement;
  }

  /**
   * Bloquea la fila del lote hasta el fin de la transacción.
   *
   * Sin esto, dos cortes simultáneos del mismo rollo leen el mismo saldo
   * inicial y el segundo pisa al primero: se surten 100 metros, el kárdex
   * registra dos salidas y el saldo sólo descuenta una.
   *
   * `FOR UPDATE` hace que la segunda transacción espere a que la primera
   * termine, y entonces lea el saldo ya actualizado.
   */
  private async lockLot(
    tx: PrismaTransaction,
    lotId: string,
  ): Promise<LotWithMaterial> {
    await tx.$queryRaw`SELECT id FROM lots WHERE id = ${lotId} FOR UPDATE`;

    // El SELECT ... FOR UPDATE sólo toma el candado; los datos se leen aquí,
    // ya con la garantía de que nadie más los está modificando.
    const lot = await tx.lot.findUnique({
      where: { id: lotId },
      include: { material: true },
    });

    if (!lot) throw new NotFoundError("el rollo", lotId);

    return lot;
  }

  /**
   * Estado y condición de retazo que le tocan al lote con el saldo nuevo.
   *
   * Con `if` explícitos y salida temprana: son cuatro reglas de negocio
   * distintas y encadenarlas en ternarias las volvería ilegibles.
   */
  private resolveStatus(
    lot: LotWithMaterial,
    balanceAfter: number,
  ): { status: Lot["status"]; isRemnant: boolean } {
    // Se acabó el rollo.
    if (balanceAfter <= 0) {
      return { status: "DEPLETED", isRemnant: lot.isRemnant };
    }

    // Al bajar del umbral pasa a retazo automáticamente. Los retazos se
    // ofrecen primero al surtir; si no, se acumulan en una esquina hasta
    // que ya no sirven.
    const threshold = lot.material.remnantThreshold;
    if (
      threshold !== null &&
      balanceAfter <= Number(threshold) &&
      isRemnantEligible(lot.status)
    ) {
      return { status: "REMNANT", isRemnant: true };
    }

    // Estaba agotado y volvió a tener saldo: una devolución de producción o
    // un ajuste positivo lo revive.
    if (lot.status === "DEPLETED") {
      return { status: "AVAILABLE", isRemnant: lot.isRemnant };
    }

    // En cualquier otro caso el estado no lo decide el saldo: un rollo en
    // cuarentena sigue en cuarentena aunque le entre material.
    return { status: lot.status, isRemnant: lot.isRemnant };
  }

  /**
   * Registra el movimiento y además lo audita.
   *
   * Se separa de applyMovement porque el kárdex y la bitácora responden
   * preguntas distintas: Movement dice qué pasó con el rollo; AuditLog, quién
   * metió mano. Los ajustes y las bajas necesitan las dos.
   */
  async applyMovementAudited(
    request: MovementRequest,
    audit: { sensitivity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; reason?: string },
  ): Promise<Movement> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.lot.findUnique({
        where: { id: request.lotId },
        select: { currentQuantity: true, status: true, locationId: true },
      });

      const movement = await this.applyMovementWithin(tx, request);

      const after = await tx.lot.findUnique({
        where: { id: request.lotId },
        select: { currentQuantity: true, status: true, locationId: true },
      });

      await new AuditService(this.context, tx).record({
        entity: "Lot",
        entityId: request.lotId,
        action: "UPDATE",
        reference: movement.code,
        oldValue: before,
        newValue: after,
        sensitivity: audit.sensitivity,
        reason: audit.reason ?? request.reason,
      });

      return movement;
    }, TRANSACTION_OPTIONS);
  }

  /**
   * Suma de los movimientos de un lote: lo que su kárdex dice que debería
   * ser el saldo. Se usa para verificar integridad.
   */
  async sumMovements(lotId: string, db: PrismaExecutor = prisma): Promise<number> {
    const result = await db.movement.aggregate({
      where: { lotId },
      _sum: { quantity: true },
    });

    return round4(Number(result._sum.quantity ?? 0));
  }
}
