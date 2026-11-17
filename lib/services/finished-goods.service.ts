import type { FinishedMovementType } from "@prisma/client";
import { BusinessRuleError, InsufficientStockError, NotFoundError } from "@/lib/core/errors";
import type { PrismaExecutor } from "@/lib/prisma";
import type {
  AdjustFinishedGoodsInput,
  FinishedPoMoveInput,
  FinishedStockKeyInput,
} from "@/lib/validations/finished-goods.schema";
import { BaseService } from "./base.service";

export interface FinishedMoveInput extends FinishedStockKeyInput {
  type: FinishedMovementType;
  /** Con signo: positivo entra, negativo sale. */
  quantity: number;
  reason?: string;
  /** La salida de taller que lo origina, para el kárdex. */
  workshopOutputId?: string;
  /** La caja a la que entra o de la que sale. */
  packingBoxId?: string;
}

/** La llave del renglón. "-" donde falta, para que dos vacíos sí choquen. */
export function finishedStockKey(input: FinishedStockKeyInput): string {
  return [input.productId, input.sizeId, input.clientId ?? "-", input.clientPo ?? "-"].join("|");
}

/**
 * La ÚNICA puerta para mover prenda terminada (Facade), igual que
 * InventoryService con la tela.
 *
 * `FinishedStock.quantity` sólo se escribe aquí, en la misma transacción que
 * el movimiento y con la fila bloqueada. Si algún día el saldo no cuadra con
 * el kárdex, alguien lo escribió fuera de este archivo.
 */
export class FinishedGoodsService extends BaseService {
  /** Ajuste manual, con motivo. Queda en la auditoría como cambio importante. */
  async adjust(input: AdjustFinishedGoodsInput): Promise<{ stockId: string; quantity: number }> {
    return this.transaction(async (tx) => {
      const sign = input.direction === "IN" ? 1 : -1;
      const result = await this.applyWith(tx, {
        productId: input.productId,
        sizeId: input.sizeId,
        clientId: input.clientId,
        clientPo: input.clientPo,
        type: input.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        quantity: sign * input.quantity,
        reason: input.reason,
      });

      await this.auditWith(tx).record({
        entity: "FinishedStock", entityId: result.stockId, action: "UPDATE",
        reference: finishedStockKey(input),
        oldValue: { cantidad: result.quantity - sign * input.quantity },
        newValue: { cantidad: result.quantity },
        sensitivity: "HIGH", reason: input.reason,
      });

      return result;
    });
  }

  /** Ponerle PO a piezas que están "Sin PO". Embarques, todos los días. */
  async assignPo(input: FinishedPoMoveInput): Promise<{ stockId: string; quantity: number }> {
    return this.movePo(input, "ASSIGN");
  }

  /** Cambiar una PO que ya traían. Sólo ADMIN, con motivo. */
  async changePo(input: FinishedPoMoveInput): Promise<{ stockId: string; quantity: number }> {
    return this.movePo(input, "CHANGE");
  }

  /**
   * La PO es parte de la llave del renglón, así que cambiarla es PASAR
   * piezas: salen del renglón de la PO anterior y entran al de la nueva, en
   * la misma transacción. Así el kárdex de los dos cuenta lo que pasó y el
   * saldo de cada uno sigue siendo la suma de sus movimientos.
   */
  private async movePo(
    input: FinishedPoMoveInput,
    mode: "ASSIGN" | "CHANGE",
  ): Promise<{ stockId: string; quantity: number }> {
    return this.transaction(async (tx) => {
      const source = await this.lockSource(tx, input.stockId);
      assertPoMove(source.clientPo, input.clientPo, mode);

      const from = source.clientPo ?? "SIN PO";
      const reason = [`PO ${from} → ${input.clientPo}`, input.reason].filter(Boolean).join(" · ");
      await this.applyToStockWith(tx, source.id, { type: "PO_CHANGE_OUT", quantity: -input.quantity, reason });
      const target = await this.applyWith(tx, {
        productId: source.productId, sizeId: source.sizeId,
        clientId: source.clientId ?? undefined, clientPo: input.clientPo,
        type: "PO_CHANGE_IN", quantity: input.quantity, reason,
      });

      await this.auditWith(tx).record({
        entity: "FinishedStock", entityId: source.id, action: "UPDATE",
        reference: source.key,
        oldValue: { po: source.clientPo, cantidad: input.quantity },
        newValue: { po: input.clientPo, cantidad: input.quantity },
        // Poner la primera PO es rutina; mover una que vino de la orden no.
        sensitivity: mode === "CHANGE" ? "HIGH" : "MEDIUM",
        reason: input.reason,
      });
      return target;
    });
  }

  private async lockSource(tx: PrismaExecutor, stockId: string) {
    await tx.$queryRaw`SELECT id FROM finished_stock WHERE id = ${stockId} FOR UPDATE`;
    const source = await tx.finishedStock.findUnique({
      where: { id: stockId },
      select: { id: true, key: true, productId: true, sizeId: true, clientId: true, clientPo: true },
    });
    if (!source) throw new NotFoundError("el renglón de inventario terminado", stockId);
    return source;
  }

  /**
   * Aplica UN movimiento dentro de la transacción de quien llama (la salida
   * de un taller, meter a caja). Se expone así para que el movimiento y lo
   * que lo origina se guarden juntos o no se guarde ninguno.
   */
  async applyWith(
    tx: PrismaExecutor,
    input: FinishedMoveInput,
  ): Promise<{ stockId: string; quantity: number }> {
    const stockId = await this.ensureStock(tx, input);
    return this.applyToStockWith(tx, stockId, input);
  }

  /**
   * Lo mismo sobre un renglón que ya existe y se conoce por su id: meter o
   * sacar de una caja, donde se eligió el renglón del inventario.
   */
  async applyToStockWith(
    tx: PrismaExecutor,
    stockId: string,
    input: Omit<FinishedMoveInput, keyof FinishedStockKeyInput>,
  ): Promise<{ stockId: string; quantity: number }> {
    // Sin el candado, dos cajas llenándose a la vez leerían el mismo saldo y
    // entre las dos sacarían de más.
    await tx.$queryRaw`SELECT id FROM finished_stock WHERE id = ${stockId} FOR UPDATE`;
    const stock = await tx.finishedStock.findUnique({ where: { id: stockId }, select: { quantity: true } });
    if (!stock) throw new NotFoundError("el renglón de inventario terminado", stockId);

    const next = stock.quantity + input.quantity;
    if (next < 0) {
      throw new InsufficientStockError(-input.quantity, stock.quantity, "pzas");
    }

    await tx.finishedMovement.create({
      data: {
        stockId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        workshopOutputId: input.workshopOutputId ?? null,
        packingBoxId: input.packingBoxId ?? null,
        userId: this.context.userId ?? null,
      },
    });
    await tx.finishedStock.update({ where: { id: stockId }, data: { quantity: next } });

    return { stockId, quantity: next };
  }

  /**
   * El renglón nace en cero la primera vez que se mueve. Su saldo lo pone el
   * movimiento, nunca el alta: así el kárdex arranca completo.
   */
  private async ensureStock(tx: PrismaExecutor, input: FinishedStockKeyInput): Promise<string> {
    const key = finishedStockKey(input);
    const stock = await tx.finishedStock.upsert({
      where: { key },
      create: {
        key,
        productId: input.productId,
        sizeId: input.sizeId,
        clientId: input.clientId ?? null,
        clientPo: input.clientPo ?? null,
      },
      update: {},
      select: { id: true },
    });
    return stock.id;
  }
}

/**
 * Qué se deja según lo que ya trae el renglón. Se decide con la PO que
 * tiene EN LA BASE y no con lo que pinta la pantalla: si otro le puso PO
 * hace un minuto, Embarques ya no la puede mover aunque su pantalla siga
 * diciendo "Sin PO".
 */
function assertPoMove(current: string | null, next: string, mode: "ASSIGN" | "CHANGE"): void {
  if (mode === "ASSIGN" && current !== null) {
    throw new BusinessRuleError("Estas piezas ya tienen PO. Cambiarla le toca al administrador.", "clientPo");
  }
  if (mode === "CHANGE" && current === null) {
    throw new BusinessRuleError("Estas piezas no tienen PO: usa Asignar PO.", "clientPo");
  }
  if (current === next) {
    throw new BusinessRuleError("Es la misma PO que ya tienen.", "clientPo");
  }
}
