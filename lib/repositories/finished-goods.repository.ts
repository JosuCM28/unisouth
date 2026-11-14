import type { FinishedStock, Prisma } from "@prisma/client";
import { BaseRepository, type PrismaDelegate } from "@/lib/core/base-repository";
import type { FinishedGoodsFilters } from "@/lib/validations/finished-goods.schema";

/**
 * Tope de renglones en pantalla. Sobra para una bodega de prenda terminada;
 * si se llega, la pantalla lo dice y pide afinar el filtro.
 */
export const FINISHED_STOCK_LIMIT = 500;

const STOCK_SELECT = {
  id: true,
  quantity: true,
  clientPo: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      garmentCategory: { select: { id: true, name: true, position: true } },
    },
  },
  size: { select: { id: true, code: true, order: true } },
  client: { select: { id: true, name: true } },
} satisfies Prisma.FinishedStockSelect;

export type FinishedStockRow = Prisma.FinishedStockGetPayload<{ select: typeof STOCK_SELECT }>;

const MOVEMENT_SELECT = {
  id: true,
  type: true,
  quantity: true,
  reason: true,
  createdAt: true,
  user: { select: { name: true } },
  /* De qué salida, taller y orden vino: la trazabilidad hasta el corte. */
  workshopOutput: {
    select: {
      code: true,
      workshop: { select: { name: true } },
      order: { select: { code: true, reference: true } },
    },
  },
  /* A qué pedido y caja fue (o de cuál regresó). */
  packingBox: { select: { number: true, order: { select: { code: true, name: true } } } },
} satisfies Prisma.FinishedMovementSelect;

export type FinishedMovementRow = Prisma.FinishedMovementGetPayload<{ select: typeof MOVEMENT_SELECT }>;

/** Lectura del inventario de Embarques. Cero reglas: ésas viven en el servicio. */
export class FinishedGoodsRepository extends BaseRepository<
  FinishedStock,
  Prisma.FinishedStockCreateInput,
  Prisma.FinishedStockUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.finishedStock;
  }

  protected get entityName(): string {
    return "el renglón de inventario terminado";
  }

  /** Lo que HAY: un renglón en cero ya no estorba en la lista. */
  async findStock(filters: FinishedGoodsFilters): Promise<FinishedStockRow[]> {
    return this.db.finishedStock.findMany({
      where: toWhere(filters),
      select: STOCK_SELECT,
      orderBy: [{ product: { name: "asc" } }, { size: { order: "asc" } }, { clientPo: "asc" }],
      take: FINISHED_STOCK_LIMIT,
    });
  }

  /**
   * Las opciones de los filtros, sacadas de lo que hay en existencia: un
   * filtro que ofrece una PO sin prendas sólo lleva a una lista vacía.
   */
  async findFilterOptions() {
    const rows = await this.db.finishedStock.findMany({
      where: { quantity: { gt: 0 } },
      select: {
        clientPo: true,
        client: { select: { id: true, name: true } },
        size: { select: { id: true, code: true, order: true } },
      },
    });

    return {
      clients: uniqueBy(rows.flatMap((row) => (row.client ? [row.client] : [])), (c) => c.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
      pos: [...new Set(rows.flatMap((row) => (row.clientPo ? [row.clientPo] : [])))].sort(),
      sizes: uniqueBy(rows.map((row) => row.size), (s) => s.id).sort((a, b) => a.order - b.order),
    };
  }

  /** El kárdex de un renglón, lo más reciente arriba. */
  async findMovements(stockId: string): Promise<FinishedMovementRow[]> {
    return this.db.finishedMovement.findMany({
      where: { stockId },
      select: MOVEMENT_SELECT,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  /** Productos que se pueden cargar a mano, con su tipo para reconocerlos. */
  async findProductOptions() {
    return this.db.finishedProduct.findMany({
      where: { deletedAt: null, active: true },
      select: {
        id: true,
        code: true,
        name: true,
        clientId: true,
        garmentCategory: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });
  }
}

function toWhere(filters: FinishedGoodsFilters): Prisma.FinishedStockWhereInput {
  const search = filters.search?.trim();
  return {
    quantity: { not: 0 },
    ...(filters.forClientId
      ? { AND: [{ OR: [{ clientId: filters.forClientId }, { clientId: null }] }] }
      : {}),
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.clientPo ? { clientPo: filters.clientPo } : {}),
    ...(filters.sizeId ? { sizeId: filters.sizeId } : {}),
    ...(filters.categoryId ? { product: { categoryId: filters.categoryId } } : {}),
    ...(search
      ? {
          OR: [
            { product: { name: { contains: search, mode: "insensitive" } } },
            { product: { code: { contains: search, mode: "insensitive" } } },
            { clientPo: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const item of items) if (!seen.has(key(item))) seen.set(key(item), item);
  return [...seen.values()];
}
