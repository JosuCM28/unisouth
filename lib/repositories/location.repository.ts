import type { Location, LocationType, Prisma } from "@prisma/client";
import { PHYSICALLY_PRESENT_FILTER } from "@/lib/constants/lot-status";
import {
  BaseRepository,
  type PaginatedResult,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

export interface LocationFilters extends PaginationInput {
  search?: string;
  warehouseId?: string;
  type?: LocationType;
  active?: boolean;
}

export interface LocationWithLotCount extends Location {
  lotCount: number;
}

/** Fila cruda de Prisma: el `_count` antes de aplanarlo a `lotCount`. */
type LocationWithCountRow = Location & { _count: { lots: number } };

export class LocationRepository extends BaseRepository<
  Location,
  Prisma.LocationCreateInput,
  Prisma.LocationUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.location;
  }

  protected get entityName(): string {
    return "la ubicación";
  }

  async search(filters: LocationFilters = {}): Promise<PaginatedResult<Location>> {
    const where: Prisma.LocationWhereInput = {};

    if (filters.search) {
      // El auxiliar busca por el código pintado en el piso ("F3") o por el
      // nombre; no sabe cuál de los dos campos guarda qué.
      where.OR = [
        { code: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.type) where.type = filters.type;
    if (filters.active !== undefined) where.active = filters.active;
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;

    return this.paginate<Location>(
      where,
      // Por `order` y no alfabético: refleja el recorrido físico de la bodega.
      [{ order: "asc" }, { code: "asc" }],
      filters,
    );
  }

  /**
   * Página de ubicaciones ya con su conteo de rollos.
   *
   * Reemplaza al par "traer todo + filtrar en memoria": la búsqueda y el
   * recorte los hace Postgres, así que la pantalla aguanta una bodega con
   * miles de ubicaciones sin traérselas todas a la vez.
   */
  async searchWithLotCount(
    filters: LocationFilters = {},
  ): Promise<PaginatedResult<LocationWithLotCount>> {
    const where: Prisma.LocationWhereInput = {};

    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.type) where.type = filters.type;
    if (filters.active !== undefined) where.active = filters.active;
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;

    const result = await this.paginate<LocationWithCountRow>(
      where,
      // Por `order` y no alfabético: refleja el recorrido físico de la bodega.
      [{ order: "asc" }, { code: "asc" }],
      filters,
      {
        _count: {
          select: { lots: { where: { status: PHYSICALLY_PRESENT_FILTER } } },
        },
      },
    );

    return {
      ...result,
      items: result.items.map(({ _count, ...location }) => ({
        ...location,
        lotCount: _count.lots,
      })),
    };
  }

  /**
   * Todas las ubicaciones con cuántos rollos tienen encima.
   *
   * Cuenta sólo lo que ocupa lugar: un lote agotado o dado de baja sigue
   * apuntando a su ubicación por historial, pero ya no estorba en la fila.
   */
  async findAllWithLotCount(): Promise<LocationWithLotCount[]> {
    const locations = await this.db.location.findMany({
      where: this.notDeleted,
      orderBy: [{ order: "asc" }, { code: "asc" }],
      include: {
        _count: {
          select: { lots: { where: { status: PHYSICALLY_PRESENT_FILTER } } },
        },
      },
    });

    return locations.map(({ _count, ...location }) => ({
      ...location,
      lotCount: _count.lots,
    }));
  }

  /** Cuántos rollos hay realmente en esta ubicación. */
  async countLots(locationId: string): Promise<number> {
    return this.db.lot.count({
      where: { locationId, status: PHYSICALLY_PRESENT_FILTER },
    });
  }

  /** Para los <Select>: sólo lo que necesita pintar una opción. */
  async findOptions(): Promise<Pick<Location, "id" | "code" | "name" | "type">[]> {
    return this.db.location.findMany({
      where: { ...this.notDeleted, active: true },
      select: { id: true, code: true, name: true, type: true },
      orderBy: [{ order: "asc" }, { code: "asc" }],
    });
  }
}
