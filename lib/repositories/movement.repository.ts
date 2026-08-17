import type {
  Movement,
  MovementDirection,
  MovementType,
  Prisma,
} from "@prisma/client";
import {
  BaseRepository,
  type PaginatedResult,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

export interface MovementFilters extends PaginationInput {
  direction?: MovementDirection;
  type?: MovementType;
  materialId?: string;
  lotId?: string;
  productionRunId?: string;
  from?: Date;
  to?: Date;
  /** Busca por folio de movimiento, de rollo o por motivo. */
  search?: string;
}

export interface MovementWithRelations extends Movement {
  lot: { id: string; code: string; shade: string | null };
  material: { id: string; code: string; name: string };
  document: { id: string; code: string } | null;
  productionRun: { id: string; code: string } | null;
  fromLocation: { code: string } | null;
  toLocation: { code: string } | null;
}

/**
 * El kárdex: qué entró y qué salió de cada rollo.
 *
 * Sólo lectura. `Movement` es append-only —una corrección es OTRO movimiento
 * de ajuste, nunca un UPDATE— así que aquí no hay `create` ni `update`: los
 * asientos los escribe `InventoryService` dentro de la misma transacción que
 * mueve el saldo, y no debe haber ninguna otra puerta de entrada.
 */
export class MovementRepository extends BaseRepository<
  Movement,
  never,
  never
> {
  /** El kárdex no se borra ni lógicamente: no existe `deletedAt`. */
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.movement;
  }

  protected get entityName(): string {
    return "el movimiento";
  }

  async search(
    filters: MovementFilters = {},
  ): Promise<PaginatedResult<MovementWithRelations>> {
    const where: Prisma.MovementWhereInput = {};

    if (filters.direction) where.direction = filters.direction;
    if (filters.type) where.type = filters.type;
    if (filters.materialId) where.materialId = filters.materialId;
    if (filters.lotId) where.lotId = filters.lotId;
    if (filters.productionRunId) {
      where.productionRunId = filters.productionRunId;
    }

    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: "insensitive" } },
        { lot: { code: { contains: filters.search, mode: "insensitive" } } },
        { reason: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return this.paginate<MovementWithRelations>(
      where,
      // Cronológico inverso: lo último que pasó es lo que se viene a mirar.
      { createdAt: "desc" },
      filters,
      {
        lot: { select: { id: true, code: true, shade: true } },
        material: { select: { id: true, code: true, name: true } },
        document: { select: { id: true, code: true } },
        productionRun: { select: { id: true, code: true } },
        fromLocation: { select: { code: true } },
        toLocation: { select: { code: true } },
      },
    );
  }

  /**
   * Totales de entrada y salida del periodo consultado.
   *
   * Se calculan sobre el MISMO filtro que la lista pero sin paginar: si se
   * sumaran las 50 filas de la página, el encabezado diría una cosa distinta
   * cada vez que el auxiliar avanza de página.
   */
  async totalsByDirection(
    filters: MovementFilters = {},
  ): Promise<{ inbound: number; outbound: number }> {
    const where: Prisma.MovementWhereInput = {};

    if (filters.type) where.type = filters.type;
    if (filters.materialId) where.materialId = filters.materialId;
    if (filters.lotId) where.lotId = filters.lotId;

    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const rows = await this.db.movement.groupBy({
      by: ["direction"],
      where,
      _sum: { quantity: true },
    });

    const totals = { inbound: 0, outbound: 0 };

    for (const row of rows as {
      direction: MovementDirection;
      _sum: { quantity: Prisma.Decimal | null };
    }[]) {
      const amount = Number(row._sum.quantity ?? 0);
      if (row.direction === "IN") totals.inbound = amount;
      // Las salidas se guardan en negativo: se muestra el valor absoluto.
      if (row.direction === "OUT") totals.outbound = Math.abs(amount);
    }

    return totals;
  }

  /** Materiales que ya tienen movimientos, para poblar el filtro. */
  async findMaterials(): Promise<{ id: string; code: string; name: string }[]> {
    const rows = await this.db.movement.findMany({
      distinct: ["materialId"],
      select: { material: { select: { id: true, code: true, name: true } } },
      orderBy: { materialId: "asc" },
    });

    return (rows as { material: { id: string; code: string; name: string } }[])
      .map((row) => row.material)
      .sort((a, b) => a.name.localeCompare(b.name, "es-MX"));
  }
}
