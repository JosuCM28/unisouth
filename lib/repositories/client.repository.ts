import type { Client, Prisma } from "@prisma/client";
import { PHYSICALLY_PRESENT_FILTER } from "@/lib/constants/lot-status";
import {
  BaseRepository,
  type PaginatedResult,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

export interface ClientFilters extends PaginationInput {
  search?: string;
  active?: boolean;
}

export interface ClientWithLotCount extends Client {
  lotCount: number;
}

/** Fila cruda de Prisma: el `_count` antes de aplanarlo a `lotCount`. */
type ClientWithCountRow = Client & { _count: { lots: number } };

export class ClientRepository extends BaseRepository<
  Client,
  Prisma.ClientCreateInput,
  Prisma.ClientUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.client;
  }

  protected get entityName(): string {
    return "el cliente";
  }

  async search(filters: ClientFilters = {}): Promise<PaginatedResult<Client>> {
    const where: Prisma.ClientWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
        { legalName: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.active !== undefined) where.active = filters.active;

    return this.paginate<Client>(where, { name: "asc" }, filters);
  }

  /**
   * Página de clientes ya con su conteo de rollos.
   *
   * Reemplaza al par "traer todo + filtrar en memoria": la búsqueda y el
   * recorte los hace Postgres, así que la pantalla se comporta igual con 20
   * clientes que con 20 000 y no se cae al crecer el catálogo.
   */
  async searchWithLotCount(
    filters: ClientFilters = {},
  ): Promise<PaginatedResult<ClientWithLotCount>> {
    const where: Prisma.ClientWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
        { legalName: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.active !== undefined) where.active = filters.active;

    const result = await this.paginate<ClientWithCountRow>(
      where,
      { name: "asc" },
      filters,
      {
        _count: {
          select: { lots: { where: { status: PHYSICALLY_PRESENT_FILTER } } },
        },
      },
    );

    return {
      ...result,
      items: result.items.map(({ _count, ...client }) => ({
        ...client,
        lotCount: _count.lots,
      })),
    };
  }

  async countLots(clientId: string): Promise<number> {
    return this.db.lot.count({
      where: { clientId, status: PHYSICALLY_PRESENT_FILTER },
    });
  }

  async findOptions(): Promise<Pick<Client, "id" | "name" | "code">[]> {
    return this.db.client.findMany({
      where: { ...this.notDeleted, active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }
}
