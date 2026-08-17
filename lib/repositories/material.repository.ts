import type { Material, MaterialType, Prisma, Unit } from "@prisma/client";
import { PHYSICALLY_PRESENT_FILTER } from "@/lib/constants/lot-status";
import {
  BaseRepository,
  type PaginatedResult,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

export interface MaterialFilters extends PaginationInput {
  search?: string;
  type?: MaterialType;
  active?: boolean;
}

/** Lo mínimo que necesita un <Select> para pintar una opción. */
export interface MaterialOption {
  id: string;
  code: string;
  name: string;
  baseUnit: Unit;
  type: MaterialType;
}

export class MaterialRepository extends BaseRepository<
  Material,
  Prisma.MaterialCreateInput,
  Prisma.MaterialUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.material;
  }

  protected get entityName(): string {
    return "el material";
  }

  async search(filters: MaterialFilters = {}): Promise<PaginatedResult<Material>> {
    const where: Prisma.MaterialWhereInput = {};

    if (filters.search) {
      // Se busca también por color y composición porque en el piso el
      // material se pide como "la mezclilla índigo", no por su código.
      where.OR = [
        { code: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
        { colorName: { contains: filters.search, mode: "insensitive" } },
        { composition: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.type) where.type = filters.type;
    if (filters.active !== undefined) where.active = filters.active;

    return this.paginate<Material>(where, { name: "asc" }, filters);
  }

  /** Opciones para los <Select>. Trae 5 columnas, no la ficha completa. */
  async findOptions(type?: MaterialType): Promise<MaterialOption[]> {
    return this.db.material.findMany({
      where: {
        ...this.notDeleted,
        active: true,
        ...(type ? { type } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        baseUnit: true,
        type: true,
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Existencias por material, sumadas EN LA BASE con groupBy.
   *
   * Traer los lotes y sumarlos en memoria funcionaría hoy con 7 rollos, pero
   * con 20 mil significa mover toda la tabla por la red en cada carga de
   * pantalla. La suma la hace Postgres.
   */
  async getStockByMaterial(materialIds: string[]): Promise<Map<string, number>> {
    if (materialIds.length === 0) return new Map();

    const grouped = await this.db.lot.groupBy({
      by: ["materialId"],
      where: {
        materialId: { in: materialIds },
        status: PHYSICALLY_PRESENT_FILTER,
      },
      _sum: { currentQuantity: true, reservedQuantity: true },
    });

    return new Map(
      grouped.map((row) => [
        row.materialId,
        // Lo realmente disponible: nunca se surte por encima de esto.
        Number(row._sum.currentQuantity ?? 0) -
          Number(row._sum.reservedQuantity ?? 0),
      ]),
    );
  }

  /** ¿Ya existe otro material con ese código? */
  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    return this.exists({ code }, excludeId);
  }
}
