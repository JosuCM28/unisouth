import type { FinishedProduct, Size } from "@prisma/client";
import { BusinessRuleError, DuplicateError } from "@/lib/core/errors";
import type { ProductInput, SizeInput } from "@/lib/validations/product.schema";
import { BaseService } from "./base.service";

export class ProductService extends BaseService {
  async create(input: ProductInput): Promise<FinishedProduct> {
    return this.transaction(async (tx) => {
      const exists = await tx.finishedProduct.findFirst({
        where: { code: input.code, deletedAt: null },
      });
      if (exists) throw new DuplicateError("el producto", "código", input.code, "code");

      const product = await tx.finishedProduct.create({ data: input });

      await this.auditWith(tx).record({
        entity: "FinishedProduct", entityId: product.id, action: "CREATE",
        reference: product.code, newValue: product, sensitivity: "LOW",
      });

      return product;
    });
  }

  async update(id: string, input: ProductInput): Promise<FinishedProduct> {
    return this.transaction(async (tx) => {
      const before = await tx.finishedProduct.findUnique({ where: { id } });
      if (!before) throw new BusinessRuleError("No se encontró el producto.");

      const dup = await tx.finishedProduct.findFirst({
        where: { code: input.code, deletedAt: null, id: { not: id } },
      });
      if (dup) throw new DuplicateError("el producto", "código", input.code, "code");

      const product = await tx.finishedProduct.update({ where: { id }, data: input });

      await this.auditWith(tx).record({
        entity: "FinishedProduct", entityId: id, action: "UPDATE",
        reference: product.code, oldValue: before, newValue: product, sensitivity: "MEDIUM",
      });

      return product;
    });
  }

  async remove(id: string, reason?: string): Promise<FinishedProduct> {
    return this.transaction(async (tx) => {
      const before = await tx.finishedProduct.findUnique({ where: { id } });
      if (!before) throw new BusinessRuleError("No se encontró el producto.");

      const product = await tx.finishedProduct.update({
        where: { id }, data: { deletedAt: new Date(), active: false },
      });

      await this.auditWith(tx).record({
        entity: "FinishedProduct", entityId: id, action: "DELETE",
        reference: before.code, oldValue: before, newValue: product,
        sensitivity: "HIGH", reason,
      });

      return product;
    });
  }
}

/**
 * Catálogo de tallas.
 *
 * El `consumptionFactor` es lo que evita duplicar la ficha técnica por cada
 * talla: la G consume 1.08 veces lo de la M, y con eso basta.
 */
export class SizeService extends BaseService {
  async create(input: SizeInput): Promise<Size> {
    return this.transaction(async (tx) => {
      const exists = await tx.size.findUnique({ where: { code: input.code } });
      if (exists) throw new DuplicateError("la talla", "código", input.code, "code");

      const size = await tx.size.create({ data: input });

      await this.auditWith(tx).record({
        entity: "Size", entityId: size.id, action: "CREATE",
        reference: size.code, newValue: size, sensitivity: "LOW",
      });

      return size;
    });
  }

  /**
   * Editar el factor NO recalcula los cálculos viejos: sus números están
   * congelados como snapshot. Sólo afecta a los cálculos que se corran
   * a partir de ahora.
   */
  async update(id: string, input: SizeInput): Promise<Size> {
    return this.transaction(async (tx) => {
      const before = await tx.size.findUnique({ where: { id } });
      if (!before) throw new BusinessRuleError("No se encontró la talla.");

      const dup = await tx.size.findFirst({
        where: { code: input.code, id: { not: id } },
      });
      if (dup) throw new DuplicateError("la talla", "código", input.code, "code");

      const size = await tx.size.update({ where: { id }, data: input });

      await this.auditWith(tx).record({
        entity: "Size", entityId: id, action: "UPDATE",
        reference: size.code, oldValue: before, newValue: size, sensitivity: "MEDIUM",
      });

      return size;
    });
  }

  async remove(id: string, reason?: string): Promise<Size> {
    return this.transaction(async (tx) => {
      const before = await tx.size.findUnique({
        where: { id },
        include: { _count: { select: { bomLines: true, calculationLines: true } } },
      });
      if (!before) throw new BusinessRuleError("No se encontró la talla.");

      const used = before._count.bomLines + before._count.calculationLines;
      if (used > 0) {
        throw new BusinessRuleError(
          `La talla ${before.code} se usa en ${used} ${used === 1 ? "registro" : "registros"}. Desactívala en vez de borrarla.`,
        );
      }

      const size = await tx.size.update({ where: { id }, data: { active: false } });

      await this.auditWith(tx).record({
        entity: "Size", entityId: id, action: "DELETE",
        reference: before.code, oldValue: before, newValue: size,
        sensitivity: "HIGH", reason,
      });

      return size;
    });
  }
}
