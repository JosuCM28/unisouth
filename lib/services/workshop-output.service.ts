import type { WorkshopKind } from "@prisma/client";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/lib/core/errors";
import {
  WorkshopOutputRepository,
  type PieceCount,
  type WorkshopOutputRow,
} from "@/lib/repositories/workshop-output.repository";
import type { PrismaExecutor } from "@/lib/prisma";
import type { WorkshopOutputInput } from "@/lib/validations/workshop-output.schema";
import { BaseService } from "./base.service";

export interface BalanceSize {
  sizeId: string;
  sizeCode: string;
  /** Lo que sigue en la mesa del taller y todavía puede salir. */
  available: number;
}

export interface WorkshopBalanceOrder {
  orderId: string;
  code: string;
  reference: string | null;
  description: string | null;
  clientName: string | null;
  sizes: BalanceSize[];
}

export interface OutputWorkshop {
  id: string;
  name: string;
  kind: WorkshopKind;
}

/** Saldo por "orden:talla". */
type BalanceMap = Map<string, number>;

const balanceKey = (orderId: string, sizeId: string) => `${orderId}:${sizeId}`;

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
    const balance = await computeBalance(repo, workshopId);
    return describeBalance(repo, balance);
  }

  async listFor(workshopId: string): Promise<WorkshopOutputRow[]> {
    return this.repo().findForWorkshop(workshopId);
  }

  async destinationsFor(workshopId: string): Promise<{ id: string; name: string }[]> {
    return this.repo().findDestinations(workshopId);
  }

  async listForOrder(orderId: string): Promise<WorkshopOutputRow[]> {
    return this.repo().findForOrder(orderId);
  }

  async create(role: string, input: WorkshopOutputInput): Promise<WorkshopOutputRow> {
    return this.transaction(async (tx) => {
      const repo = this.repo(tx);
      const workshop = await this.requireProcessWorkshop(tx, role);
      await this.assertDestination(tx, workshop.id, input.destinationWorkshopId);

      // El candado va ANTES de leer el saldo: si no, dos salidas al mismo
      // tiempo leerían lo mismo y entre las dos sacarían de más.
      await repo.lockWorkshop(workshop.id);
      const balance = await computeBalance(repo, workshop.id, input.orderId);
      await assertWithinBalance(repo, balance, input);

      const code = await this.sequencesWith(tx).next("WORKSHOP_OUTPUT", "ST", 4);
      const output = await tx.workshopOutput.create({
        data: {
          code,
          type: "PROCESSED",
          workshopId: workshop.id,
          orderId: input.orderId,
          destinationWorkshopId: input.destinationWorkshopId ?? null,
          date: input.date ?? new Date(),
          parts: input.parts,
          notes: input.notes,
          createdById: this.context.userId ?? null,
          lines: {
            create: input.lines.map((line, position) => ({ ...line, position })),
          },
        },
      });

      await this.auditWith(tx).record({
        entity: "WorkshopOutput", entityId: output.id, action: "CREATE",
        reference: code, newValue: { taller: workshop.name, ...input }, sensitivity: "MEDIUM",
      });

      const row = await repo.findRow(output.id);
      if (!row) throw new NotFoundError("la salida de taller", output.id);
      return row;
    });
  }

  /**
   * Cancelar, nunca editar ni borrar: lo que el taller dijo que sacó queda
   * escrito, y el motivo dice por qué dejó de contar. Las piezas regresan a
   * su saldo en ese momento, porque el saldo se calcula y la cancelada ya no
   * se suma.
   *
   * `role` = el taller que la cancela, y sólo puede la suya. `null` = ADMIN
   * desde la ficha de la orden, que corrige la de cualquiera.
   */
  async cancel(id: string, reason: string, role: string | null): Promise<void> {
    await this.transaction(async (tx) => {
      const output = await tx.workshopOutput.findUnique({
        where: { id },
        select: { id: true, code: true, workshopId: true, cancelledAt: true, workshop: { select: { accessRole: true } } },
      });
      if (!output) throw new NotFoundError("la salida de taller", id);
      if (role !== null && output.workshop.accessRole !== role) {
        throw new ForbiddenError("Esa salida es de otro taller.");
      }
      if (output.cancelledAt) throw new BusinessRuleError(`La salida ${output.code} ya estaba cancelada.`);

      await tx.workshopOutput.update({
        where: { id },
        data: { cancelledAt: new Date(), cancelledById: this.context.userId ?? null, cancellationReason: reason },
      });

      await this.auditWith(tx).record({
        entity: "WorkshopOutput", entityId: id, action: "CANCEL",
        reference: output.code, sensitivity: "HIGH", reason,
      });
    });
  }

  /**
   * Por ahora sólo un taller de PROCESO captura esta salida. El de
   * confección saca prenda terminada hacia Embarques, que es otra salida con
   * producto y PO; dejarlo capturar ésta mientras tanto mezclaría las dos.
   */
  private async requireProcessWorkshop(tx: PrismaExecutor, role: string): Promise<OutputWorkshop> {
    const workshop = await tx.workshop.findFirst({
      where: { accessRole: role, deletedAt: null },
      select: { id: true, name: true, kind: true },
    });
    if (!workshop) throw new ForbiddenError("Tu cuenta no está ligada a ningún taller.");
    if (workshop.kind !== "PROCESS") {
      throw new BusinessRuleError("Tu taller confecciona: su salida es a Embarques, no ésta.");
    }
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
}

/** Recibido menos lo que ya salió, por orden y talla. */
async function computeBalance(
  repo: WorkshopOutputRepository,
  workshopId: string,
  orderId?: string,
): Promise<BalanceMap> {
  const [shipments, vouchers, out] = await Promise.all([
    repo.receivedFromShipments(workshopId, orderId),
    repo.receivedFromVouchers(workshopId, orderId),
    repo.alreadyOut(workshopId, orderId),
  ]);

  const balance: BalanceMap = new Map();
  const add = (counts: PieceCount[], sign: 1 | -1) => {
    for (const { orderId: order, sizeId, pieces } of counts) {
      const key = balanceKey(order, sizeId);
      balance.set(key, (balance.get(key) ?? 0) + sign * pieces);
    }
  };
  add(shipments, 1);
  add(vouchers, 1);
  add(out, -1);
  return balance;
}

/** Ninguna talla puede sacar más de lo que el taller tiene de esa orden. */
async function assertWithinBalance(
  repo: WorkshopOutputRepository,
  balance: BalanceMap,
  input: WorkshopOutputInput,
): Promise<void> {
  const short = input.lines.filter(
    (line) => line.quantity + line.scrapQuantity > (balance.get(balanceKey(input.orderId, line.sizeId)) ?? 0),
  );
  if (short.length === 0) return;

  const sizes = await repo.findSizes(short.map((line) => line.sizeId));
  const detail = short
    .map((line) => {
      const code = sizes.find((size) => size.id === line.sizeId)?.code ?? "?";
      const available = Math.max(0, balance.get(balanceKey(input.orderId, line.sizeId)) ?? 0);
      return `${code}: tienes ${available}`;
    })
    .join(" · ");

  throw new BusinessRuleError(
    `Sacas más de lo que tienes de esta orden (${detail}). Si te llegó más, primero márcalo como recibido.`,
  );
}

/** El saldo con nombres, sólo lo que todavía tiene piezas. */
async function describeBalance(
  repo: WorkshopOutputRepository,
  balance: BalanceMap,
): Promise<WorkshopBalanceOrder[]> {
  const live = [...balance.entries()]
    .filter(([, pieces]) => pieces > 0)
    .map(([key, pieces]) => {
      const [orderId = "", sizeId = ""] = key.split(":");
      return { orderId, sizeId, pieces };
    });

  const [orders, sizes] = await Promise.all([
    repo.findOrdersInfo([...new Set(live.map((entry) => entry.orderId))]),
    repo.findSizes([...new Set(live.map((entry) => entry.sizeId))]),
  ]);
  const sizeById = new Map(sizes.map((size) => [size.id, size]));

  return orders
    .map((order) => ({
      orderId: order.id,
      code: order.code,
      reference: order.reference,
      description: order.description,
      clientName: order.client?.name ?? null,
      sizes: live
        .filter((entry) => entry.orderId === order.id)
        .sort((a, b) => (sizeById.get(a.sizeId)?.order ?? 0) - (sizeById.get(b.sizeId)?.order ?? 0))
        .map((entry) => ({
          sizeId: entry.sizeId,
          sizeCode: sizeById.get(entry.sizeId)?.code ?? "?",
          available: entry.pieces,
        })),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
