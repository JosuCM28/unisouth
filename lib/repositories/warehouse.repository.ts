import type { Prisma, Warehouse } from "@prisma/client";
import { PHYSICALLY_PRESENT_FILTER } from "@/lib/constants/lot-status";
import {
  BaseRepository,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

export interface WarehouseFilters extends PaginationInput {
  search?: string;
  active?: boolean;
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

/** Qué tan lleno está cada almacén. Es la vista de disponibilidad. */
export interface WarehouseWithStock extends Warehouse {
  locationCount: number;
  lotCount: number;
}

export class WarehouseRepository extends BaseRepository<
  Warehouse,
  Prisma.WarehouseCreateInput,
  Prisma.WarehouseUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.warehouse;
  }

  protected get entityName(): string {
    return "el almacén";
  }

  /** Opciones para los <Select>. */
  async findOptions(): Promise<WarehouseOption[]> {
    return this.db.warehouse.findMany({
      where: { ...this.notDeleted, active: true },
      select: { id: true, code: true, name: true },
      // El principal primero: es donde cae casi todo.
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  /**
   * El almacén al que van los rollos cuando nadie dice otra cosa.
   *
   * Devuelve null si no hay ninguno marcado, en vez de inventar uno: que la
   * capa de arriba decida si eso es un error o si simplemente hay que pedirle
   * al usuario que elija.
   */
  async findDefault(): Promise<Warehouse | null> {
    return this.db.warehouse.findFirst({
      where: { ...this.notDeleted, active: true, isDefault: true },
    });
  }

  /**
   * Todos los almacenes con cuántas ubicaciones y cuántos rollos tienen.
   *
   * Los conteos los hace Postgres: traer los rollos para contarlos movería
   * toda la tabla por la red en cada carga de pantalla.
   */
  async findAllWithStock(): Promise<WarehouseWithStock[]> {
    const warehouses = await this.db.warehouse.findMany({
      where: this.notDeleted,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { locations: true } },
        locations: {
          select: {
            _count: {
              select: { lots: { where: { status: PHYSICALLY_PRESENT_FILTER } } },
            },
          },
        },
      },
    });

    return warehouses.map(
      ({ _count, locations, ...warehouse }: {
        _count: { locations: number };
        locations: { _count: { lots: number } }[];
      } & Warehouse) => ({
        ...warehouse,
        locationCount: _count.locations,
        // Los rollos cuelgan de la ubicación, no del almacén: se suman los de
        // todas sus ubicaciones.
        lotCount: locations.reduce((total, l) => total + l._count.lots, 0),
      }),
    );
  }
}
