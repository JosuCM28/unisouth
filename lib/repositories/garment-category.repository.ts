import type { GarmentCategory, Prisma } from "@prisma/client";
import { BaseRepository, type PrismaDelegate } from "@/lib/core/base-repository";

export interface GarmentCategoryOption {
  id: string;
  name: string;
}

export interface GarmentCategoryListItem extends GarmentCategory {
  productCount: number;
}

/** Orden de lectura: el que el catálogo pide, y el nombre desempata. */
const CATEGORY_ORDER = [{ position: "asc" }, { name: "asc" }] satisfies Prisma.GarmentCategoryOrderByWithRelationInput[];

export class GarmentCategoryRepository extends BaseRepository<
  GarmentCategory,
  Prisma.GarmentCategoryCreateInput,
  Prisma.GarmentCategoryUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.garmentCategory;
  }

  protected get entityName(): string {
    return "el tipo de prenda";
  }

  /** Para selectores y filtros: sólo las vivas. */
  async findOptions(): Promise<GarmentCategoryOption[]> {
    return this.db.garmentCategory.findMany({
      where: { ...this.notDeleted, active: true },
      select: { id: true, name: true },
      orderBy: CATEGORY_ORDER,
    });
  }

  /** El catálogo completo, con cuántos productos cuelgan de cada una. */
  async findAllWithCounts(): Promise<GarmentCategoryListItem[]> {
    const categories = await this.db.garmentCategory.findMany({
      where: this.notDeleted,
      orderBy: CATEGORY_ORDER,
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });

    return categories.map(({ _count, ...category }) => ({
      ...category,
      productCount: _count.products,
    }));
  }
}
