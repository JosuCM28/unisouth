import type { Helper, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PaginatedResult,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

export interface HelperFilters extends PaginationInput {
  search?: string;
  active?: boolean;
}

/** Ayudante con lo que ha descargado, que es la base de su bonificación. */
export interface HelperWithWork extends Helper {
  lotCount: number;
  /** Metros/piezas totales bajados. Se suma por unidad en la interfaz. */
  totalQuantity: number;
}

export class HelperRepository extends BaseRepository<
  Helper,
  Prisma.HelperCreateInput,
  Prisma.HelperUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.helper;
  }

  protected get entityName(): string {
    return "el ayudante";
  }

  async search(filters: HelperFilters = {}): Promise<PaginatedResult<Helper>> {
    const where: Prisma.HelperWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.active !== undefined) where.active = filters.active;

    return this.paginate<Helper>(where, { name: "asc" }, filters);
  }

  /**
   * Todos con su carga de trabajo.
   *
   * La suma se hace con groupBy en la base, no trayendo los rollos: con
   * varios meses de recepciones eso sería mover miles de filas por la red
   * para calcular un total.
   */
  async findAllWithWork(range?: {
    from?: Date;
    to?: Date;
  }): Promise<HelperWithWork[]> {
    const lotFilter: Prisma.LotWhereInput = {};

    if (range?.from || range?.to) {
      lotFilter.receivedAt = {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.to ? { lte: range.to } : {}),
      };
    }

    const [helpers, grouped] = await Promise.all([
      this.db.helper.findMany({
        where: this.notDeleted,
        orderBy: { name: "asc" },
      }),
      this.db.lot.groupBy({
        by: ["helperId"],
        where: { helperId: { not: null }, ...lotFilter },
        _count: { _all: true },
        _sum: { initialQuantity: true },
      }),
    ]);

    const work = new Map(
      grouped.map(
        (row: {
          helperId: string | null;
          _count: { _all: number };
          _sum: { initialQuantity: Prisma.Decimal | null };
        }) => [
          row.helperId,
          {
            lotCount: row._count._all,
            // Se usa initialQuantity y no currentQuantity: se le paga por lo
            // que bajó del camión, no por lo que queda tras los cortes.
            totalQuantity: Number(row._sum.initialQuantity ?? 0),
          },
        ],
      ),
    );

    return helpers.map((helper: Helper) => ({
      ...helper,
      lotCount: work.get(helper.id)?.lotCount ?? 0,
      totalQuantity: work.get(helper.id)?.totalQuantity ?? 0,
    }));
  }

  /** Para los <Select> de la recepción. */
  async findOptions(): Promise<Pick<Helper, "id" | "name" | "code">[]> {
    return this.db.helper.findMany({
      where: { ...this.notDeleted, active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }
}
