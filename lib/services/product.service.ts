import type { FinishedProduct, Size } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { BusinessRuleError, DuplicateError } from "@/lib/core/errors";
import type {
  ProductInput,
  QuickProductInput,
  SizeInput,
} from "@/lib/validations/product.schema";

/** Lo que el selector necesita del producto recién dado de alta. */
export interface QuickProduct {
  id: string;
  code: string;
  name: string;
  clientId: string | null;
  category: string | null;
}
import { BaseService } from "./base.service";

export class ProductService extends BaseService {
  async create(input: ProductInput): Promise<FinishedProduct> {
    return this.transaction(async (tx) => {
      await this.assertCodeFree(tx, input.code);

      const product = await tx.finishedProduct.create({ data: input });

      await this.auditWith(tx).record({
        entity: "FinishedProduct", entityId: product.id, action: "CREATE",
        reference: product.code, newValue: product, sensitivity: "LOW",
      });

      return product;
    });
  }

  /**
   * Alta rápida: nombre, tipo y cliente, desde la salida a Embarques o la
   * entrada manual. Si ya existe uno con ese nombre y cliente se devuelve ése
   * en vez de crear otro: en el piso el mismo producto se teclearía dos veces
   * y el inventario quedaría partido entre dos fichas iguales.
   */
  async quickCreate(input: QuickProductInput): Promise<QuickProduct> {
    return this.transaction(async (tx) => {
      const category = await tx.garmentCategory.findFirst({
        where: { id: input.categoryId, deletedAt: null },
        select: { name: true },
      });
      if (!category) throw new BusinessRuleError("Elige un tipo de prenda del catálogo.", "categoryId");

      const existing = await tx.finishedProduct.findFirst({
        where: { name: input.name, clientId: input.clientId ?? null, deletedAt: null },
        include: { garmentCategory: { select: { name: true } } },
      });
      if (existing) return toQuickProduct(existing, existing.garmentCategory?.name ?? null);

      const product = await tx.finishedProduct.create({
        data: {
          code: await freeCode(tx, input.name),
          name: input.name,
          categoryId: input.categoryId,
          clientId: input.clientId ?? null,
        },
      });

      await this.auditWith(tx).record({
        entity: "FinishedProduct", entityId: product.id, action: "CREATE",
        reference: product.code, newValue: product, sensitivity: "LOW",
      });

      return toQuickProduct(product, category.name);
    });
  }

  async update(id: string, input: ProductInput): Promise<FinishedProduct> {
    return this.transaction(async (tx) => {
      const before = await tx.finishedProduct.findUnique({ where: { id } });
      if (!before) throw new BusinessRuleError("No se encontró el producto.");

      await this.assertCodeFree(tx, input.code, id);

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

  /**
   * El código es único en la tabla aunque el producto esté dado de baja: la
   * baja es lógica para que los cálculos viejos sigan leyéndolo. Sin esta
   * revisión, reusar el código de uno dado de baja reventaba en la base con
   * un error que el usuario no puede entender.
   */
  private async assertCodeFree(
    tx: PrismaExecutor,
    code: string,
    exceptId?: string,
  ): Promise<void> {
    const taken = await tx.finishedProduct.findFirst({
      where: { code, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { deletedAt: true },
    });
    if (!taken) return;

    if (taken.deletedAt) {
      throw new BusinessRuleError(
        `El código ${code} era de un producto dado de baja. Usa otro código.`,
        "code",
      );
    }
    throw new DuplicateError("el producto", "código", code, "code");
  }
}

function toQuickProduct(product: FinishedProduct, category: string | null): QuickProduct {
  return {
    id: product.id, code: product.code, name: product.name, clientId: product.clientId, category,
  };
}

/**
 * Código a partir del nombre: "Camisa manga larga" → CAMISA-MANGA-LARGA. Sin
 * acentos ni símbolos para que se pueda teclear y buscar. Si ya existe
 * (aunque esté dado de baja: el código es único en la tabla) se le agrega -2,
 * -3…
 */
async function freeCode(tx: PrismaExecutor, name: string): Promise<string> {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 34) || "PRODUCTO";

  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const code = suffix === 1 ? base : `${base}-${suffix}`;
    const taken = await tx.finishedProduct.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new BusinessRuleError("No se pudo armar un código para ese nombre. Dalo de alta en Productos.");
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
