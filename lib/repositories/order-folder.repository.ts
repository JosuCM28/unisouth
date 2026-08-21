import type { OrderFolder, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

export interface OrderFolderFilters extends PaginationInput {
  search?: string;
  clientId?: string;
  /** Incluir las archivadas. Por omisión sólo se listan las vivas. */
  includeArchived?: boolean;
}

/** Una carpeta con lo que suman sus órdenes. */
export interface OrderFolderWithTotals extends OrderFolder {
  client: { id: string; name: string } | null;
  orderCount: number;
  /** Piezas pedidas y cortadas sumando TODAS sus órdenes. */
  orderedQuantity: number;
  cutQuantity: number;
  /** Órdenes que ya no tienen nada pendiente. */
  completedCount: number;
}

/**
 * Lectura de carpetas de pedido.
 *
 * Sin soft delete: la carpeta es una agrupación, no un catálogo al que apunte
 * el kárdex. Se archiva para quitarla de en medio, y si de verdad se borra,
 * sus órdenes quedan sueltas en vez de irse con ella.
 */
export class OrderFolderRepository extends BaseRepository<
  OrderFolder,
  Prisma.OrderFolderCreateInput,
  Prisma.OrderFolderUpdateInput
> {
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.orderFolder;
  }

  protected get entityName(): string {
    return "la carpeta";
  }

  /**
   * Las carpetas de la lista, con el avance ya sumado.
   *
   * Los totales se calculan en la base con un groupBy sobre los renglones y
   * NO trayendo cada orden con sus tallas: una carpeta de veinte órdenes con
   * ocho tallas cada una son ciento sesenta filas viajando por la red sólo
   * para pintar "faltan 300".
   */
  async findAllWithTotals(
    filters: OrderFolderFilters = {},
  ): Promise<OrderFolderWithTotals[]> {
    const where = this.buildWhere(filters);

    const folders = await this.db.orderFolder.findMany({
      where,
      // Lo último capturado hasta arriba, igual que en el resto de las listas.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { orders: true } },
      },
    });

    if (folders.length === 0) return [];

    const totals = await this.totalsByFolder(folders.map((f) => f.id));

    return folders.map((folder) => {
      const total = totals.get(folder.id);

      return {
        ...folder,
        orderCount: folder._count.orders,
        orderedQuantity: total?.ordered ?? 0,
        cutQuantity: total?.cut ?? 0,
        completedCount: total?.completed ?? 0,
      };
    });
  }

  /** Una carpeta con sus órdenes, para la pantalla del pedido. */
  async findWithOrders(id: string) {
    return this.db.orderFolder.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        orders: {
          orderBy: [
            { orderedAt: "desc" },
            { createdAt: "desc" },
            { id: "desc" },
          ],
          include: {
            client: { select: { name: true } },
            material: { select: { name: true } },
            lines: { select: { orderedQuantity: true, cutQuantity: true } },
          },
        },
      },
    });
  }

  /** Para el selector del formulario de orden: sólo carpetas vivas. */
  async findSelectable(): Promise<
    Array<{ id: string; code: string; name: string; clientName: string | null }>
  > {
    const folders = await this.db.orderFolder.findMany({
      where: { archivedAt: null },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        name: true,
        client: { select: { name: true } },
      },
    });

    return folders.map((folder) => ({
      id: folder.id,
      code: folder.code,
      name: folder.name,
      clientName: folder.client?.name ?? null,
    }));
  }

  /** Cuántas órdenes cuelgan de la carpeta. El servicio lo usa para archivar. */
  async countOrders(folderId: string): Promise<number> {
    return this.db.cuttingOrder.count({ where: { folderId } });
  }

  private buildWhere(
    filters: OrderFolderFilters,
  ): Prisma.OrderFolderWhereInput {
    const where: Prisma.OrderFolderWhereInput = {};

    if (!filters.includeArchived) where.archivedAt = null;
    if (filters.clientId) where.clientId = filters.clientId;

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
        { reference: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  /**
   * Suma pedido y cortado de cada carpeta en una sola consulta.
   *
   * Se agrupa por orden y no por carpeta porque el renglón no conoce a la
   * carpeta: hay que pasar por la orden. Se resuelve con dos consultas planas
   * en vez de un include anidado, que es lo que evita traer las tallas.
   */
  private async totalsByFolder(folderIds: string[]) {
    const orders = await this.db.cuttingOrder.findMany({
      where: { folderId: { in: folderIds }, status: { not: "CANCELLED" } },
      select: { id: true, folderId: true },
    });

    if (orders.length === 0) return new Map<string, FolderTotals>();

    const grouped = await this.db.cuttingOrderLine.groupBy({
      by: ["orderId"],
      where: { orderId: { in: orders.map((order) => order.id) } },
      _sum: { orderedQuantity: true, cutQuantity: true },
    });

    const byOrder = new Map(
      grouped.map((row) => [
        row.orderId,
        {
          ordered: row._sum.orderedQuantity ?? 0,
          cut: row._sum.cutQuantity ?? 0,
        },
      ]),
    );

    const totals = new Map<string, FolderTotals>();

    for (const order of orders) {
      if (!order.folderId) continue;

      const current = totals.get(order.folderId) ?? {
        ordered: 0,
        cut: 0,
        completed: 0,
      };
      const line = byOrder.get(order.id) ?? { ordered: 0, cut: 0 };

      current.ordered += line.ordered;
      current.cut += line.cut;
      /* Una orden sin tallas capturadas no cuenta como terminada: `cut >=
         ordered` con ambos en cero diría que ya está lista sin haber cortado
         nada. */
      if (line.ordered > 0 && line.cut >= line.ordered) current.completed += 1;

      totals.set(order.folderId, current);
    }

    return totals;
  }
}

interface FolderTotals {
  ordered: number;
  cut: number;
  completed: number;
}
