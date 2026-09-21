import type { OrderFolder } from "@prisma/client";
/* Valor y no sólo tipo: `Prisma.join` arma la lista de ids del `IN` del SQL
   crudo sin concatenar cadenas, que es cómo se cuela una inyección. */
import { Prisma } from "@prisma/client";
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
  /** Cuántas traer. Se topa en `MAX_FOLDERS` aunque se pida más. */
  limit?: number;
  skip?: number;
}

/**
 * Techo duro de carpetas por consulta.
 *
 * No es el tamaño de página —eso lo decide la pantalla— sino el seguro: por
 * cada carpeta se suman sus órdenes y sus renglones, y una petición sin tope
 * crece sin límite conforme la fábrica acumula pedidos.
 */
const MAX_FOLDERS = 100;

/** Una carpeta con lo que suman sus órdenes. */
export interface OrderFolderWithTotals extends OrderFolder {
  client: { id: string; name: string } | null;
  orderCount: number;
  /** Piezas pedidas y cortadas sumando TODAS sus órdenes. */
  orderedQuantity: number;
  cutQuantity: number;
  /**
   * Piezas sin cortar y cortadas de más, sumadas TALLA POR TALLA.
   *
   * Viajan calculadas desde la base y no se sacan de "pedidas − cortadas"
   * porque ese neto miente: el excedente de una talla descuenta el faltante
   * de otra y la tarjeta enseña un pendiente menor al real.
   */
  pendingQuantity: number;
  surplusQuantity: number;
  /** Órdenes que ya no tienen nada pendiente. */
  completedCount: number;
}

/**
 * Lectura de carpetas de pedido.
 *
 * Sin soft delete: la carpeta es una agrupación, no un catálogo al que apunte
 * el kárdex. Se archiva para quitarla de en medio, y sólo se borra cuando ya
 * está vacía —vaciarla es un acto aparte, orden por orden—, para que tirar la
 * agrupación nunca se lleve papeles por delante.
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
      /* SIEMPRE acotado. Antes bajaba todas las carpetas y, por cada una,
         todas sus órdenes y todos sus renglones para sumar el avance: con
         cuarenta pedidos son miles de filas viajando para pintar una lista que
         nadie recorre entera. Sin `limit` se cae en el tope de seguridad, no
         en "todo". */
      take: Math.min(filters.limit ?? MAX_FOLDERS, MAX_FOLDERS),
      skip: filters.skip,
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
        pendingQuantity: total?.pending ?? 0,
        surplusQuantity: total?.surplus ?? 0,
        completedCount: total?.completed ?? 0,
      };
    });
  }

  /** Cuántas carpetas cumplen el filtro. Para el paginador. */
  async countWithTotals(filters: OrderFolderFilters = {}): Promise<number> {
    return this.db.orderFolder.count({ where: this.buildWhere(filters) });
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
            // Para el contador de comentarios internos de la tarjeta.
            _count: { select: { comments: true } },
          },
        },
      },
    });
  }

  /**
   * El pedido con el desglose por talla de cada una de sus órdenes.
   *
   * Es la lectura del CONCENTRADO: una columna por orden y un renglón por
   * talla. Las canceladas no viajan —lo que se canceló no se corta— y las
   * tallas salen en el orden del catálogo y no en el de captura, porque en la
   * hoja las columnas se comparan renglón contra renglón y dos órdenes que
   * capturaron sus tallas en distinto orden no cuadrarían.
   */
  async findForConcentrate(id: string) {
    return this.db.orderFolder.findUnique({
      where: { id },
      include: {
        client: { select: { name: true } },
        orders: {
          where: { status: { not: "CANCELLED" } },
          orderBy: [{ orderedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          include: {
            client: { select: { name: true } },
            material: { select: { code: true, name: true } },
            lines: {
              orderBy: [{ size: { order: "asc" } }, { position: "asc" }],
              select: {
                orderedQuantity: true,
                notes: true,
                size: { select: { id: true, code: true, order: true } },
                cutTag: { select: { name: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Los cortes del pedido que todavía pueden salir, con lo que dio cada uno.
   *
   * Trae TODOS los cortes —incluidos los que ya salieron— y sus vales vivos,
   * porque la pantalla tiene que poder decir "se saltan tres, ya salieron en
   * OUT-2026-0912" en vez de callárselos. Quién se salta y quién no lo decide
   * el servicio, que es donde vive la regla.
   */
  async findSendableCuts(folderId: string) {
    return this.db.cuttingOrder.findMany({
      where: { folderId, status: { not: "CANCELLED" } },
      orderBy: [{ orderedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        code: true,
        clientId: true,
        materialId: true,
        productionRunId: true,
        description: true,
        reference: true,
        notes: true,
        /* El encabezado del corte viaja entero al vale: molde, versión y sus
           notas se supieron al capturar la orden y volver a teclearlos en el
           vale es cómo terminan diciendo cosas distintas. */
        cutFabricText: true,
        cutPattern: true,
        cutVersion: true,
        cutVersionNotes: true,
        cutNotes: true,
        lines: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            sizeId: true,
            tagId: true,
            notes: true,
            size: { select: { code: true, order: true } },
          },
        },
        batches: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            number: true,
            label: true,
            entries: {
              orderBy: { createdAt: "asc" },
              select: { lineId: true, quantity: true, bundles: true },
            },
            /* Los dos caminos por los que un corte ya pudo salir: su propio
               vale y el vale global de un pedido. Se preguntan juntos porque
               omitir cualquiera de los dos deja pasar una entrega repetida. */
            issues: {
              where: { status: { not: "CANCELLED" } },
              select: { code: true, status: true },
            },
            folderIssues: {
              where: { status: { not: "CANCELLED" } },
              select: { code: true, status: true },
            },
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
   * Suma pedido, cortado, faltante y excedente de cada carpeta.
   *
   * Va en SQL crudo por el FALTANTE: `GREATEST(pedidas − cortadas, 0)` tiene
   * que evaluarse renglón por renglón, que es la única forma de que el
   * excedente de una talla no descuente el faltante de otra. El `groupBy` de
   * Prisma sólo sabe sumar columnas enteras, así que con él el pendiente
   * salía neteado y la tarjeta del pedido decía que falta menos de lo que
   * falta.
   *
   * Sigue devolviendo una fila por ORDEN y no por talla —y ahora en una sola
   * consulta en vez de dos—: es lo que evita traerse las tallas de cuarenta
   * pedidos para pintar una lista.
   */
  private async totalsByFolder(folderIds: string[]) {
    const totals = new Map<string, FolderTotals>();
    if (folderIds.length === 0) return totals;

    const rows = await this.db.$queryRaw<OrderTotalsRow[]>`
      SELECT o."folderId"                               AS "folderId",
             COALESCE(SUM(l."orderedQuantity"), 0)::int AS "ordered",
             COALESCE(SUM(l."cutQuantity"), 0)::int     AS "cut",
             COALESCE(
               SUM(GREATEST(l."orderedQuantity" - l."cutQuantity", 0)), 0
             )::int                                     AS "pending",
             COALESCE(
               SUM(GREATEST(l."cutQuantity" - l."orderedQuantity", 0)), 0
             )::int                                     AS "surplus"
      FROM cutting_orders o
      JOIN cutting_order_lines l ON l."orderId" = o.id
      WHERE o."folderId" IN (${Prisma.join(folderIds)})
        AND o.status <> 'CANCELLED'
      GROUP BY o."folderId", o.id
    `;

    for (const row of rows) {
      const current = totals.get(row.folderId) ?? {
        ordered: 0,
        cut: 0,
        pending: 0,
        surplus: 0,
        completed: 0,
      };

      current.ordered += row.ordered;
      current.cut += row.cut;
      current.pending += row.pending;
      current.surplus += row.surplus;
      /* Terminada = NINGUNA talla corta. Una orden sin tallas capturadas no
         cuenta: con todo en cero, `pending === 0` diría que ya está lista sin
         haber cortado nada. */
      if (row.ordered > 0 && row.pending === 0) current.completed += 1;

      totals.set(row.folderId, current);
    }

    return totals;
  }
}

/** Una fila del agregado: los totales de UNA orden, ya con su carpeta. */
interface OrderTotalsRow {
  folderId: string;
  ordered: number;
  cut: number;
  pending: number;
  surplus: number;
}

interface FolderTotals {
  ordered: number;
  cut: number;
  pending: number;
  surplus: number;
  completed: number;
}
