import type { Prisma, User } from "@prisma/client";
import {
  BaseRepository,
  type PaginatedResult,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";
import { toRole, type Role } from "@/lib/constants/roles";
import type { UserStatus } from "@/lib/constants/user-status";

export interface UserFilters extends PaginationInput {
  search?: string;
  role?: Role;
  status?: UserStatus;
}

/**
 * Un usuario tal como lo ve la pantalla de administración.
 *
 * Es una lista explícita y no `User` completo porque `pinHash` NO debe cruzar
 * al cliente: es un hash, y un hash en el bundle del navegador es un hash
 * regalado. Escribir los campos a mano hace que agregar una columna sensible
 * al modelo no la filtre sola.
 */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  active: boolean;
  banned: boolean;
  banReason: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  /** Sesiones vivas. Responde "¿está usando el sistema ahora mismo?". */
  sessionCount: number;
  /** Última señal de vida: cuándo se refrescó su sesión más reciente. */
  lastSeenAt: Date | null;
}

/** Sesión abierta, para el diálogo de "cerrar sesiones". */
export interface UserSession {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

export class UserRepository extends BaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  /**
   * Este repositorio SÍ ve a los dados de baja, y por eso apaga el filtro.
   *
   * En los catálogos esconder lo borrado es lo correcto; aquí es justo lo
   * contrario: la pantalla de administración existe para poder reactivar a
   * quien se dio de baja, y con el filtro puesto esa persona sería invisible
   * y su correo quedaría ocupado para siempre sin que nadie entendiera por qué.
   *
   * La baja no se hace con `BaseRepository.delete()` —que con esto haría un
   * DELETE físico— sino en `UserService`, dentro de su transacción.
   */
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.user;
  }

  protected get entityName(): string {
    return "el usuario";
  }

  async search(filters: UserFilters = {}): Promise<PaginatedResult<UserRow>> {
    const result = await this.paginate<User>(
      this.buildWhere(filters),
      { name: "asc" },
      filters,
    );

    return { ...result, items: await this.withSessions(result.items) };
  }

  /** El usuario con todos sus campos. Sólo para el servidor. */
  async findByEmail(email: string, excludeId?: string): Promise<User | null> {
    return this.db.user.findFirst({
      where: {
        email: email.toLowerCase(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  /**
   * Cuántos administradores quedan en pie, sin contar a uno.
   *
   * Es la consulta que impide que el sistema se quede sin quién administre:
   * se pregunta ANTES de bajar, suspender o cambiarle el rol a un ADMIN.
   */
  async countActiveAdmins(excludeId?: string): Promise<number> {
    return this.db.user.count({
      where: {
        role: "ADMIN",
        active: true,
        banned: false,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  /** Sesiones vivas de un usuario, la más reciente primero. */
  async findSessions(userId: string): Promise<UserSession[]> {
    return this.db.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  /** Cuántas cuentas hay en cada estado, para los chips del filtro. */
  async countByStatus(): Promise<Record<UserStatus, number>> {
    const [active, suspended, deleted] = await Promise.all([
      this.db.user.count({ where: { deletedAt: null, active: true, banned: false } }),
      this.db.user.count({
        where: { deletedAt: null, OR: [{ active: false }, { banned: true }] },
      }),
      this.db.user.count({ where: { deletedAt: { not: null } } }),
    ]);

    return { ACTIVE: active, SUSPENDED: suspended, DELETED: deleted };
  }

  /**
   * Le pega a cada usuario su conteo de sesiones vivas.
   *
   * Con `groupBy` y no con un `include` de las sesiones: traer las filas
   * completas sólo para contarlas mueve por la red el user agent de cada
   * celular de la bodega para acabar mostrando un número.
   */
  private async withSessions(users: User[]): Promise<UserRow[]> {
    const ids = users.map((user) => user.id);

    const grouped = ids.length
      ? await this.db.session.groupBy({
          by: ["userId"],
          where: { userId: { in: ids }, expiresAt: { gt: new Date() } },
          _count: { _all: true },
          _max: { updatedAt: true },
        })
      : [];

    const sessions = new Map(
      grouped.map(
        (row: {
          userId: string;
          _count: { _all: number };
          _max: { updatedAt: Date | null };
        }) => [row.userId, { count: row._count._all, lastSeenAt: row._max.updatedAt }],
      ),
    );

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: toRole(user.role),
      active: user.active,
      banned: user.banned,
      banReason: user.banReason,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      sessionCount: sessions.get(user.id)?.count ?? 0,
      lastSeenAt: sessions.get(user.id)?.lastSeenAt ?? null,
    }));
  }

  private buildWhere(filters: UserFilters): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.role) where.role = filters.role;

    /* El estado no es una columna sino la combinación de tres banderas, así
       que cada caso arma su propio filtro. Por omisión NO se listan los dados
       de baja: son los menos y ensuciarían la lista del día a día. */
    if (filters.status === "ACTIVE") {
      Object.assign(where, { deletedAt: null, active: true, banned: false });
    } else if (filters.status === "SUSPENDED") {
      Object.assign(where, {
        deletedAt: null,
        AND: [{ OR: [{ active: false }, { banned: true }] }],
      });
    } else if (filters.status === "DELETED") {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    return where;
  }
}
