import type { Prisma, ProductionRun } from "@prisma/client";
import { PHYSICALLY_PRESENT_FILTER } from "@/lib/constants/lot-status";
import {
  BaseRepository,
  type PaginatedResult,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

export interface ProductionRunFilters extends PaginationInput {
  search?: string;
  clientId?: string;
  status?: ProductionRun["status"];
}

export interface ProductionRunWithDetail extends ProductionRun {
  clientName: string;
  lotCount: number;
}

export class ProductionRunRepository extends BaseRepository<
  ProductionRun,
  Prisma.ProductionRunCreateInput,
  Prisma.ProductionRunUpdateInput
> {
  /**
   * La tabla no tiene `deletedAt`: una producción se CIERRA (status CLOSED o
   * CANCELLED), no se borra. Su historial de consumo debe seguir consultable.
   */
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.productionRun;
  }

  protected get entityName(): string {
    return "la producción";
  }

  async search(
    filters: ProductionRunFilters = {},
  ): Promise<PaginatedResult<ProductionRun>> {
    const where: Prisma.ProductionRunWhereInput = {};

    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
        { season: { contains: filters.search, mode: "insensitive" } },
        { client: { name: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.status) where.status = filters.status;

    return this.paginate<ProductionRun>(where, { createdAt: "desc" }, filters);
  }

  async findAllWithDetail(): Promise<ProductionRunWithDetail[]> {
    const runs = await this.db.productionRun.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        client: { select: { name: true } },
        _count: { select: { lots: { where: { status: PHYSICALLY_PRESENT_FILTER } } } },
      },
    });

    return runs.map(({ client, _count, ...run }) => ({
      ...run,
      clientName: client.name,
      lotCount: _count.lots,
    }));
  }

  async countLots(productionRunId: string): Promise<number> {
    return this.db.lot.count({
      where: { productionRunId, status: PHYSICALLY_PRESENT_FILTER },
    });
  }

  async findOptions(): Promise<Pick<ProductionRun, "id" | "code" | "name">[]> {
    return this.db.productionRun.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE", "PAUSED"] } },
      select: { id: true, code: true, name: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
