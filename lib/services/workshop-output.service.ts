import type { WorkshopKind } from "@prisma/client";
import {
  BusinessRuleError,
  ForbiddenError,
  InsufficientStockError,
  NotFoundError,
} from "@/lib/core/errors";
import {
  WorkshopOutputRepository,
  type WorkshopOutputRow,
} from "@/lib/repositories/workshop-output.repository";
import type { PrismaExecutor } from "@/lib/prisma";
import type {
  FinishedOutputInput,
  WorkshopOutputInput,
} from "@/lib/validations/workshop-output.schema";
import { BaseService } from "./base.service";
import { FinishedGoodsService } from "./finished-goods.service";
import {
  assertWithinBalance,
  computeBalance,
  describeBalance,
  type WorkshopBalanceOrder,
} from "./workshop-balance";

export type { BalanceSize, PoPlan, WorkshopBalanceOrder } from "./workshop-balance";

export interface OutputWorkshop {
  id: string;
  name: string;
  kind: WorkshopKind;
}

/** Qué hace la salida de cada tipo de taller, para el mensaje de error. */
const WRONG_KIND_MESSAGES: Record<WorkshopKind, string> = {
  PROCESS: "Tu taller borda o serigrafía: su salida es de piezas, no a Embarques.",
  ASSEMBLY: "Tu taller confecciona: su salida es a Embarques, no ésta.",
};

/**
 * Las salidas de un taller y su saldo.
 *
 * Igual que en las entregas, el taller lo decide el ROL de quien entra y nunca
 * un id del navegador: nadie puede sacar piezas del saldo de otro taller.
 */
export class WorkshopOutputService extends BaseService {
  private repo(db: PrismaExecutor = this.db) {
    return new WorkshopOutputRepository(db);
  }

  async findWorkshopByRole(role: string): Promise<OutputWorkshop | null> {
    return this.db.workshop.findFirst({
      where: { accessRole: role, deletedAt: null },
      select: { id: true, name: true, kind: true },
    });
  }

  /** Las órdenes donde el taller todavía tiene piezas, con su saldo por talla. */
  async balanceFor(workshopId: string): Promise<WorkshopBalanceOrder[]> {
    const repo = this.repo();
    return describeBalance(repo, await computeBalance(repo, workshopId));
  }

  async destinationsFor(workshopId: string): Promise<{ id: string; name: string }[]> {
    return this.repo().findDestinations(workshopId);
  }

  async listFor(workshopId: string): Promise<WorkshopOutputRow[]> {
    return this.repo().findForWorkshop(workshopId);
  }

  async listForOrder(orderId: string): Promise<WorkshopOutputRow[]> {
    return this.repo().findForOrder(orderId);
  }

  /** Salida de un taller de PROCESO: piezas hacia otro taller o a planta. */
  async create(role: string, input: WorkshopOutputInput): Promise<WorkshopOutputRow> {
    return this.transaction(async (tx) => {
      const repo = this.repo(tx);
      const workshop = await this.requireWorkshop(tx, role, "PROCESS");
      await this.assertDestination(tx, workshop.id, input.destinationWorkshopId);
      await this.lockAndCheck(repo, workshop.id, input.orderId, input.lines);

      const output = await tx.workshopOutput.create({
        data: {
          code: await this.nextCode(tx),
          type: "PROCESSED",
          workshopId: workshop.id,
          orderId: input.orderId,
          destinationWorkshopId: input.destinationWorkshopId ?? null,
          date: input.date ?? new Date(),
          parts: input.parts,
          notes: input.notes,
          createdById: this.context.userId ?? null,
          lines: { create: input.lines.map((line, position) => ({ ...line, position })) },
        },
      });

      await this.auditCreate(tx, output.id, output.code, workshop.name, input);
      return this.requireRow(repo, output.id);
    });
  }

  /**
   * Salida de un taller de CONFECCIÓN: prenda terminada a Embarques.
   *
   * Descontar del taller y sumar a Embarques van en la MISMA transacción: si
   * una falla, ninguna queda. Sin eso, una caída a la mitad dejaría piezas
   * que salieron del taller y nunca llegaron a ningún inventario.
   */
  async createFinished(role: string, input: FinishedOutputInput): Promise<WorkshopOutputRow> {
    return this.transaction(async (tx) => {
      const repo = this.repo(tx);
      const workshop = await this.requireWorkshop(tx, role, "ASSEMBLY");
      await this.assertProduct(tx, input.productId);
      await this.lockAndCheck(repo, workshop.id, input.orderId, input.lines);

      const output = await tx.workshopOutput.create({
        data: {
          code: await this.nextCode(tx),
          type: "FINISHED",
          workshopId: workshop.id,
          orderId: input.orderId,
          productId: input.productId,
          clientId: input.clientId ?? null,
          date: input.date ?? new Date(),
          notes: input.notes,
          createdById: this.context.userId ?? null,
          lines: { create: input.lines.map((line, position) => ({ ...line, position })) },
        },
      });

      const finished = new FinishedGoodsService(this.context);
      for (const line of input.lines.filter((entry) => entry.quantity > 0)) {
        await finished.applyWith(tx, {
          productId: input.productId,
          sizeId: line.sizeId,
          clientId: input.clientId,
          clientPo: line.clientPo,
          type: "WORKSHOP_IN",
          quantity: line.quantity,
          workshopOutputId: output.id,
        });
      }

      await this.auditCreate(tx, output.id, output.code, workshop.name, input);
      return this.requireRow(repo, output.id);
    });
  }

  /**
   * Cancelar, nunca editar ni borrar: lo que el taller dijo que sacó queda
   * escrito, y el motivo dice por qué dejó de contar. Las piezas regresan a
   * su saldo porque el saldo se calcula y la cancelada ya no se suma.
   *
   * Si era a Embarques, sale de su inventario lo que había entrado. Si
   * Embarques ya lo empacó o ajustó, no alcanza y no se deja: primero se
   * saca de la caja.
   *
   * `role` = el taller que la cancela, y sólo puede la suya. `null` = ADMIN
   * desde la ficha de la orden, que corrige la de cualquiera.
   */
  async cancel(id: string, reason: string, role: string | null): Promise<void> {
    await this.transaction(async (tx) => {
      const output = await this.requireCancellable(tx, id, role);

      await tx.workshopOutput.update({
        where: { id },
        data: { cancelledAt: new Date(), cancelledById: this.context.userId ?? null, cancellationReason: reason },
      });
      if (output.type === "FINISHED") await this.reverseFinished(tx, output, reason);

      await this.auditWith(tx).record({
        entity: "WorkshopOutput", entityId: id, action: "CANCEL",
        reference: output.code, sensitivity: "HIGH", reason,
      });
    });
  }

  private async requireCancellable(tx: PrismaExecutor, id: string, role: string | null) {
    const output = await tx.workshopOutput.findUnique({
      where: { id },
      select: {
        id: true, code: true, type: true, cancelledAt: true, productId: true, clientId: true,
        workshop: { select: { accessRole: true } },
        lines: { select: { sizeId: true, clientPo: true, quantity: true } },
      },
    });
    if (!output) throw new NotFoundError("la salida de taller", id);
    if (role !== null && output.workshop.accessRole !== role) {
      throw new ForbiddenError("Esa salida es de otro taller.");
    }
    if (output.cancelledAt) throw new BusinessRuleError(`La salida ${output.code} ya estaba cancelada.`);
    return output;
  }

  private async reverseFinished(
    tx: PrismaExecutor,
    output: Awaited<ReturnType<WorkshopOutputService["requireCancellable"]>>,
    reason: string,
  ): Promise<void> {
    if (!output.productId) return;
    const finished = new FinishedGoodsService(this.context);

    try {
      for (const line of output.lines.filter((entry) => entry.quantity > 0)) {
        await finished.applyWith(tx, {
          productId: output.productId,
          sizeId: line.sizeId,
          clientId: output.clientId ?? undefined,
          clientPo: line.clientPo ?? undefined,
          type: "WORKSHOP_IN_REVERSAL",
          quantity: -line.quantity,
          reason,
          workshopOutputId: output.id,
        });
      }
    } catch (error) {
      if (!(error instanceof InsufficientStockError)) throw error;
      throw new BusinessRuleError(
        `Embarques ya no tiene completas las piezas de ${output.code}: se empacaron o se ajustaron. Sácalas de la caja antes de cancelar.`,
      );
    }
  }

  /** El candado va ANTES de leer el saldo: si no, dos salidas al mismo tiempo leerían lo mismo. */
  private async lockAndCheck(
    repo: WorkshopOutputRepository,
    workshopId: string,
    orderId: string,
    lines: { sizeId: string; quantity: number; scrapQuantity: number }[],
  ): Promise<void> {
    await repo.lockWorkshop(workshopId);
    const balance = await computeBalance(repo, workshopId, orderId);
    await assertWithinBalance(repo, balance, orderId, lines);
  }

  private async requireWorkshop(tx: PrismaExecutor, role: string, kind: WorkshopKind): Promise<OutputWorkshop> {
    const workshop = await tx.workshop.findFirst({
      where: { accessRole: role, deletedAt: null },
      select: { id: true, name: true, kind: true },
    });
    if (!workshop) throw new ForbiddenError("Tu cuenta no está ligada a ningún taller.");
    if (workshop.kind !== kind) throw new BusinessRuleError(WRONG_KIND_MESSAGES[workshop.kind]);
    return workshop;
  }

  private async assertDestination(tx: PrismaExecutor, workshopId: string, destinationId?: string) {
    if (!destinationId) return;
    if (destinationId === workshopId) {
      throw new BusinessRuleError("El destino no puede ser tu mismo taller.", "destinationWorkshopId");
    }
    const destination = await tx.workshop.findFirst({
      where: { id: destinationId, deletedAt: null, active: true },
      select: { id: true },
    });
    if (!destination) throw new BusinessRuleError("Ese taller ya no está en el catálogo.", "destinationWorkshopId");
  }

  private async assertProduct(tx: PrismaExecutor, productId: string) {
    const product = await tx.finishedProduct.findFirst({
      where: { id: productId, deletedAt: null, active: true },
      select: { id: true },
    });
    if (!product) throw new BusinessRuleError("Ese producto ya no está en el catálogo.", "productId");
  }

  private nextCode(tx: PrismaExecutor): Promise<string> {
    return this.sequencesWith(tx).next("WORKSHOP_OUTPUT", "ST", 4);
  }

  private async auditCreate(tx: PrismaExecutor, id: string, code: string, workshopName: string, input: object) {
    await this.auditWith(tx).record({
      entity: "WorkshopOutput", entityId: id, action: "CREATE",
      reference: code, newValue: { taller: workshopName, ...input }, sensitivity: "MEDIUM",
    });
  }

  private async requireRow(repo: WorkshopOutputRepository, id: string): Promise<WorkshopOutputRow> {
    const row = await repo.findRow(id);
    if (!row) throw new NotFoundError("la salida de taller", id);
    return row;
  }
}
