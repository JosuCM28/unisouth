import type { FinishedMovementType } from "@prisma/client";
import { InsufficientStockError, NotFoundError } from "@/lib/core/errors";
import type { PrismaExecutor } from "@/lib/prisma";
import type {
  AdjustFinishedGoodsInput,
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
