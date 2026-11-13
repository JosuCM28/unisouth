import type { GarmentCategory } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { BusinessRuleError, DuplicateError } from "@/lib/core/errors";
import type { GarmentCategoryInput } from "@/lib/validations/garment-category.schema";
import { BaseService } from "./base.service";

/**
 * Catálogo de tipos de prenda.
 *
 * Plano y casi sin reglas, pero en servicio como todos: el nombre es lo que
 * filtra el inventario de Embarques, y un duplicado ("CAMISA" dos veces)
 * partiría el mismo inventario en dos filtros.
 */
export class GarmentCategoryService extends BaseService {
  async create(input: GarmentCategoryInput): Promise<GarmentCategory> {
    return this.transaction(async (tx) => {
      await this.assertNameFree(tx, input.name);

      const category = await tx.garmentCategory.create({ data: input });

      await this.auditWith(tx).record({
        entity: "GarmentCategory", entityId: category.id, action: "CREATE",
        reference: category.name, newValue: category, sensitivity: "LOW",
      });

      return category;
    });
  }

  async update(id: string, input: GarmentCategoryInput): Promise<GarmentCategory> {
    return this.transaction(async (tx) => {
      const before = await tx.garmentCategory.findUnique({ where: { id } });
      if (!before || before.deletedAt) throw new BusinessRuleError("No se encontró el tipo de prenda.");

      await this.assertNameFree(tx, input.name, id);

      const category = await tx.garmentCategory.update({ where: { id }, data: input });

      await this.auditWith(tx).record({
        entity: "GarmentCategory", entityId: id, action: "UPDATE",
        reference: category.name, oldValue: before, newValue: category, sensitivity: "LOW",
      });

      return category;
    });
  }

  /**
   * Baja lógica: los productos que ya la llevan la conservan, para que lo ya
   * empacado siga diciendo qué era. Sólo deja de ofrecerse al dar de alta.
   */
  async remove(id: string, reason?: string): Promise<GarmentCategory> {
    return this.transaction(async (tx) => {
      const before = await tx.garmentCategory.findUnique({ where: { id } });
      if (!before || before.deletedAt) throw new BusinessRuleError("No se encontró el tipo de prenda.");

      const category = await tx.garmentCategory.update({
        where: { id }, data: { active: false, deletedAt: new Date() },
      });

      await this.auditWith(tx).record({
        entity: "GarmentCategory", entityId: id, action: "DELETE",
        reference: before.name, oldValue: before, newValue: category,
        sensitivity: "MEDIUM", reason,
      });

      return category;
    });
  }

  /**
   * El nombre es único en la tabla aunque esté dado de baja. Revisarlo antes
   * da un mensaje que se entiende en vez del error crudo de la base.
   */
  private async assertNameFree(tx: PrismaExecutor, name: string, exceptId?: string): Promise<void> {
    const taken = await tx.garmentCategory.findFirst({
      where: { name, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { deletedAt: true },
    });
    if (!taken) return;

    if (taken.deletedAt) {
      throw new BusinessRuleError(`${name} existía y se dio de baja. Usa otro nombre.`, "name");
    }
    throw new DuplicateError("el tipo de prenda", "nombre", name, "name");
  }
}
