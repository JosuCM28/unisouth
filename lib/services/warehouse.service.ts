import type { Warehouse } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { BusinessRuleError, DuplicateError } from "@/lib/core/errors";
import { WarehouseRepository } from "@/lib/repositories/warehouse.repository";
import type {
  UpdateWarehouseInput,
  WarehouseInput,
} from "@/lib/validations/warehouse.schema";
import { BaseService } from "./base.service";

/**
 * Reglas de los almacenes.
 *
 * Dos que importan: no puede haber dos almacenes con el mismo código, y no se
 * puede dar de baja uno que todavía guarda material.
 */
export class WarehouseService extends BaseService {
  async create(input: WarehouseInput): Promise<Warehouse> {
    return this.transaction(async (tx) => {
      const repository = new WarehouseRepository(tx);

      if (await repository.exists({ code: input.code })) {
        throw new DuplicateError("el almacén", "código", input.code, "code");
      }

      // Antes de marcar éste como principal hay que quitárselo al anterior:
      // dos almacenes por defecto harían que el destino de un rollo sin
      // almacén dependiera del orden de la consulta.
      if (input.isDefault) await this.clearDefault(tx);

      const warehouse = await repository.create({
        code: input.code,
        name: input.name,
        address: input.address,
        notes: input.notes,
        isDefault: input.isDefault,
        active: input.active,
      });

      await this.auditWith(tx).record({
        entity: "Warehouse",
        entityId: warehouse.id,
        action: "CREATE",
        reference: warehouse.code,
        newValue: warehouse,
        sensitivity: "LOW",
      });

      return warehouse;
    });
  }

  async update(input: UpdateWarehouseInput): Promise<Warehouse> {
    return this.transaction(async (tx) => {
      const repository = new WarehouseRepository(tx);
      const before = await repository.findByIdOrThrow(input.id);

      if (await repository.exists({ code: input.code }, input.id)) {
        throw new DuplicateError("el almacén", "código", input.code, "code");
      }

      if (input.isDefault) await this.clearDefault(tx, input.id);

      const warehouse = await repository.update(input.id, {
        code: input.code,
        name: input.name,
        address: input.address,
        notes: input.notes,
        isDefault: input.isDefault,
        active: input.active,
      });

      await this.auditWith(tx).record({
        entity: "Warehouse",
        entityId: warehouse.id,
        action: "UPDATE",
        reference: warehouse.code,
        oldValue: before,
        newValue: warehouse,
        sensitivity: "LOW",
      });

      return warehouse;
    });
  }

  /**
   * Baja lógica.
   *
   * Se niega si todavía hay ubicaciones con rollos encima: dar de baja el
   * almacén dejaría ese material sin lugar en el mapa y nadie sabría dónde
   * buscarlo.
   */
  async remove(id: string): Promise<Warehouse> {
    return this.transaction(async (tx) => {
      const repository = new WarehouseRepository(tx);
      const warehouse = await repository.findByIdOrThrow(id);

      const lotsInside = await tx.lot.count({
        where: { location: { warehouseId: id } },
      });

      if (lotsInside > 0) {
        throw new BusinessRuleError(
          `El almacén todavía guarda ${lotsInside} rollo(s). Muévelos antes de darlo de baja.`,
        );
      }

      if (warehouse.isDefault) {
        throw new BusinessRuleError(
          "Es el almacén por defecto. Marca otro como principal antes de darlo de baja.",
        );
      }

      const removed = await repository.delete(id);

      await this.auditWith(tx).record({
        entity: "Warehouse",
        entityId: id,
        action: "DELETE",
        reference: warehouse.code,
        oldValue: warehouse,
        sensitivity: "MEDIUM",
      });

      return removed;
    });
  }

  /** Deja sin `isDefault` a cualquier otro almacén. */
  private async clearDefault(
    tx: PrismaExecutor,
    exceptId?: string,
  ): Promise<void> {
    await tx.warehouse.updateMany({
      where: {
        isDefault: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isDefault: false },
    });
  }
}
