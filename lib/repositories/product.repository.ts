import type { FinishedProduct, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PaginatedResult,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

/**
 * Cuál es la ficha VIGENTE de un producto.
 *
 * Las fichas ya no se activan a mano: la vigente es la versión más reciente
 * que no se haya jubilado. Antes se exigía `ACTIVE` y el editor nunca ofreció
 * cómo activarla, así que todas se quedaban en borrador y ningún producto
 * aparecía en Cálculo ni en Salidas. `OBSOLETE` sigue existiendo porque es lo
 * que deja la versión vieja cuando un cálculo ya la usó y se crea la v2.
 *
 * Se exporta como selección para que todos los lectores usen el mismo
 * criterio: si uno pidiera `ACTIVE` y otro "la última", verían fichas
 * distintas del mismo producto.
 */
export const CURRENT_BOM_SELECTION = {
  where: { status: { not: "OBSOLETE" } },
  orderBy: { version: "desc" },
  take: 1,
} satisfies Prisma.FinishedProduct$billsOfMaterialsArgs;

/** Producto como lo ofrece un selector de Cálculo o de Salidas. */
export interface ProductOption {
  id: string;
  code: string;
  name: string;
  /** La ficha vigente, o null si el producto todavía no tiene ficha. */
  activeBomId: string | null;
}

export interface ProductListItem extends FinishedProduct {
  clientName: string | null;
  categoryName: string | null;
  /** Versión de la ficha vigente, o null si aún no tiene. */
  bomVersion: number | null;
}

export interface ProductListInput {
  page: number;
  pageSize: number;
  accumulate: boolean;
  /** Sólo los de este tipo de prenda. */
  categoryId?: string;
}

export class ProductRepository extends BaseRepository<
  FinishedProduct,
  Prisma.FinishedProductCreateInput,
  Prisma.FinishedProductUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.finishedProduct;
  }

  protected get entityName(): string {
    return "el producto";
  }

  /** Productos vivos con el selector de ficha vigente. */
  async findOptions(): Promise<ProductOption[]> {
    const products = await this.db.finishedProduct.findMany({
      where: { ...this.notDeleted, active: true },
      select: {
        id: true,
        code: true,
        name: true,
        billsOfMaterials: { ...CURRENT_BOM_SELECTION, select: { id: true } },
      },
      orderBy: { name: "asc" },
    });

    return products.map(({ billsOfMaterials, ...product }) => ({
      ...product,
      activeBomId: billsOfMaterials[0]?.id ?? null,
    }));
  }

  /** La lista del catálogo, con el cliente y la versión vigente. */
  async findPage(input: ProductListInput): Promise<PaginatedResult<ProductListItem>> {
    /* "Cargar más" del celular: trae desde la primera fila hasta el final de
       esta página, porque lo ya mostrado no sobrevive en estado del cliente.
       Se topa para no bajar la tabla entera. */
    const skip = input.accumulate ? 0 : (input.page - 1) * input.pageSize;
    const take = input.accumulate
      ? Math.min(input.page * input.pageSize, 300)
      : input.pageSize;
    const where = {
      ...this.notDeleted,
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    };

    const [total, products] = await Promise.all([
      this.db.finishedProduct.count({ where }),
      this.db.finishedProduct.findMany({
        where,
        // El id desempata: dos productos pueden llamarse igual y sin criterio
        // estable se barajarían entre páginas.
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip,
        take,
        include: {
          client: { select: { name: true } },
          garmentCategory: { select: { name: true } },
          billsOfMaterials: { ...CURRENT_BOM_SELECTION, select: { version: true } },
        },
      }),
    ]);

    return {
      items: products.map(({ client, garmentCategory, billsOfMaterials, ...product }) => ({
        ...product,
        clientName: client?.name ?? null,
        categoryName: garmentCategory?.name ?? null,
        bomVersion: billsOfMaterials[0]?.version ?? null,
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize) || 1,
    };
  }

  /** El producto con su ficha vigente completa, para el editor. */
  async findWithCurrentBom(id: string) {
    return this.db.finishedProduct.findFirst({
      where: { id, ...this.notDeleted },
      include: {
        billsOfMaterials: {
          ...CURRENT_BOM_SELECTION,
          include: {
            lines: { orderBy: { order: "asc" } },
            _count: { select: { calculationLines: true } },
          },
        },
      },
    });
  }

  async findName(id: string): Promise<string | null> {
    const product = await this.db.finishedProduct.findUnique({
      where: { id },
      select: { name: true },
    });
    return product?.name ?? null;
  }
}
