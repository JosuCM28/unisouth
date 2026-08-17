import type { AuditAction, AuditLog, Prisma, Sensitivity } from "@prisma/client";
import {
  BaseRepository, type PaginatedResult, type PaginationInput, type PrismaDelegate,
} from "@/lib/core/base-repository";

export interface AuditFilters extends PaginationInput {
  userId?: string;
  entity?: string;
  action?: AuditAction;
  sensitivity?: Sensitivity;
  from?: Date;
  to?: Date;
  search?: string;
}

export interface AuditLogWithUser extends AuditLog {
  user: { id: string; name: string } | null;
}

export class AuditRepository extends BaseRepository<
  AuditLog,
  Prisma.AuditLogCreateInput,
  never
> {
  /** La bitácora es append-only: no hay `deletedAt` ni borrado de ningún tipo. */
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.auditLog;
  }

  protected get entityName(): string {
    return "el registro de auditoría";
  }

  async search(filters: AuditFilters = {}): Promise<PaginatedResult<AuditLogWithUser>> {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.entity) where.entity = filters.entity;
    if (filters.action) where.action = filters.action;
    if (filters.sensitivity) where.sensitivity = filters.sensitivity;

    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: "insensitive" } },
        { reason: { contains: filters.search, mode: "insensitive" } },
        { userName: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return this.paginate<AuditLogWithUser>(
      where,
      { createdAt: "desc" },
      filters,
      { user: { select: { id: true, name: true } } },
    );
  }

  /** Entidades que ya tienen registros, para poblar el filtro. */
  async findEntities(): Promise<string[]> {
    const rows = await this.db.auditLog.findMany({
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
    });
    return rows.map((row: { entity: string }) => row.entity);
  }

  /** Usuarios que han dejado rastro, para el filtro por persona. */
  async findActors(): Promise<{ id: string; name: string }[]> {
    const rows = await this.db.auditLog.findMany({
      where: { userId: { not: null } },
      distinct: ["userId"],
      select: { userId: true, userName: true },
      orderBy: { userName: "asc" },
    });

    return (rows as { userId: string | null; userName: string | null }[])
      .filter(
        (row): row is { userId: string; userName: string | null } =>
          row.userId !== null,
      )
      .map((row) => ({ id: row.userId, name: row.userName ?? "Sin nombre" }));
  }
}
