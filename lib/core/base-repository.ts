import { prisma, type PrismaExecutor } from "@/lib/prisma";
import { NotFoundError } from "./errors";

/**
 * Delegado genérico de Prisma (prisma.lot, prisma.material, …).
 *
 * ENCAPSULAMIENTO: éste es el ÚNICO `any` permitido en la capa de datos.
 * Prisma genera un tipo distinto e incompatible por cada modelo, así que no
 * hay forma de escribir un repositorio genérico sin borrar el tipo aquí. Se
 * aísla en este punto: las subclases recuperan la seguridad de tipos al
 * declarar sus parámetros TEntity / TCreate / TUpdate.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type PrismaDelegate = any;

export interface PaginationInput {
  page?: number;
  pageSize?: number;
  /**
   * Trae TODO desde la página 1 hasta `page`, en vez de sólo esa página.
   *
   * Es lo que necesita el "cargar más" del celular: cada toque es una
   * navegación que remonta el componente, así que lo ya mostrado no puede
   * vivir en estado del cliente —se borraría— y tiene que volver a llegar
   * desde la base junto con lo nuevo.
   */
  accumulate?: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Tope del acumulado de "cargar más".
 *
 * Sin él, la página 20 pediría 1 000 filas y el celular acabaría bajándose la
 * bodega entera con datos móviles. Al llegar aquí el botón deja de crecer y
 * el usuario sigue con el buscador, que es más rápido que seguir cargando.
 */
const MAX_ACCUMULATED = 300;

/**
 * Base de todo acceso a datos.
 *
 * ABSTRACCIÓN: expone `findById`, `paginate`, `delete` con nombres del
 * dominio y esconde por completo que debajo hay Prisma. Quien la usa no sabe
 * de `findUnique`, `deletedAt` ni de `skip`/`take`.
 *
 * HERENCIA: todos los repositorios de la app extienden esta clase, así que
 * el soft delete, la paginación y el "no encontrado" se comportan igual en
 * todas partes sin volver a escribirse.
 *
 * Cero reglas de negocio aquí: eso vive en los servicios.
 */
export abstract class BaseRepository<TEntity, TCreate, TUpdate> {
  /**
   * ENCAPSULAMIENTO: `protected`. Nadie fuera de la jerarquía toca Prisma
   * directamente; ése es justo el acoplamiento que esta clase evita.
   */
  protected abstract get delegate(): PrismaDelegate;

  /** Nombre en español para los mensajes de error ("el rollo", "el material"). */
  protected abstract get entityName(): string;

  /**
   * Los catálogos se dan de baja lógicamente para no romper el historial:
   * un movimiento viejo debe seguir mostrando a qué material apuntaba.
   * Un repositorio sin columna `deletedAt` lo pone en false.
   */
  protected readonly usesSoftDelete: boolean = true;

  /**
   * El executor: cliente normal o transacción.
   *
   * Recibirlo permite que el repositorio participe en la transacción que
   * abrió el servicio sin enterarse de cuál de los dos le tocó.
   */
  protected readonly db: PrismaExecutor;

  constructor(db: PrismaExecutor = prisma) {
    this.db = db;
  }

  /** Filtro de "vivos". Se compone con el `where` de cada consulta. */
  protected get notDeleted(): Record<string, unknown> {
    return this.usesSoftDelete ? { deletedAt: null } : {};
  }

  async findById(id: string, include?: object): Promise<TEntity | null> {
    return this.delegate.findFirst({
      where: { id, ...this.notDeleted },
      ...(include ? { include } : {}),
    });
  }

  /**
   * Igual que findById pero exige que exista.
   *
   * Evita que cada servicio repita el mismo `if (!x) throw`.
   */
  async findByIdOrThrow(id: string, include?: object): Promise<TEntity> {
    const entity = await this.findById(id, include);
    if (!entity) throw new NotFoundError(this.entityName, id);
    return entity;
  }

  /** Búsqueda por la clave natural: el folio o código que el usuario conoce. */
  async findByCode(code: string, include?: object): Promise<TEntity | null> {
    return this.delegate.findFirst({
      where: { code, ...this.notDeleted },
      ...(include ? { include } : {}),
    });
  }

  /**
   * ¿Existe otro registro con estos datos?
   *
   * `excludeId` sirve al editar: el propio registro no cuenta como duplicado
   * de sí mismo.
   */
  async exists(
    where: Record<string, unknown>,
    excludeId?: string,
  ): Promise<boolean> {
    const count = await this.delegate.count({
      where: {
        ...where,
        ...this.notDeleted,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return count > 0;
  }

  async create(data: TCreate, include?: object): Promise<TEntity> {
    return this.delegate.create({
      data,
      ...(include ? { include } : {}),
    });
  }

  async update(id: string, data: TUpdate, include?: object): Promise<TEntity> {
    await this.findByIdOrThrow(id);
    return this.delegate.update({
      where: { id },
      data,
      ...(include ? { include } : {}),
    });
  }

  /**
   * Baja lógica. Nunca DELETE físico en catálogos: el kárdex y la auditoría
   * apuntan a estos registros y deben seguir siendo legibles años después.
   */
  async delete(id: string): Promise<TEntity> {
    await this.findByIdOrThrow(id);

    if (!this.usesSoftDelete) {
      return this.delegate.delete({ where: { id } });
    }

    return this.delegate.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  /** Deshace una baja lógica. */
  async restore(id: string): Promise<TEntity> {
    return this.delegate.update({
      where: { id },
      data: { deletedAt: null, active: true },
    });
  }

  async count(where: Record<string, unknown> = {}): Promise<number> {
    return this.delegate.count({ where: { ...where, ...this.notDeleted } });
  }

  /**
   * TEMPLATE METHOD: este método fija el algoritmo de paginación —normalizar
   * la página, contar y traer en paralelo, calcular el total de páginas— y
   * dejan a la subclase sólo el `where` y el `orderBy` propios de su dominio.
   *
   * `protected` porque cada repositorio expone su propio método público con
   * filtros con nombre (`search`, `byLocation`), no un `where` crudo de Prisma.
   */
  protected async paginate<T = TEntity>(
    where: Record<string, unknown> = {},
    orderBy: Record<string, unknown> | Record<string, unknown>[] = {
      createdAt: "desc",
    },
    pagination: PaginationInput = {},
    include?: object,
  ): Promise<PaginatedResult<T>> {
    const page = Math.max(1, pagination.page ?? 1);
    // Se acota el tamaño: sin tope, un pageSize enorme tumba la conexión.
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, pagination.pageSize ?? DEFAULT_PAGE_SIZE),
    );

    const fullWhere = { ...where, ...this.notDeleted };

    /**
     * Desempate obligatorio por `id`.
     *
     * Sin esto la paginación PIERDE registros. Los criterios del dominio
     * —`receivedAt`, `createdAt`— no son únicos: en una recepción entran 120
     * rollos con la misma fecha. Ante un empate Postgres no garantiza ningún
     * orden, y como cada página es una consulta aparte, puede devolver la
     * misma fila en la página 1 y en la 2 mientras otra no sale en ninguna.
     * El `id` es único, así que fija un orden total y estable entre páginas.
     */
    const stableOrderBy = [
      ...(Array.isArray(orderBy) ? orderBy : [orderBy]),
      { id: "asc" },
    ];

    /* Acumulado: desde la primera fila hasta el final de la página pedida.
       Se topa igual que una página normal —el tope por página sigue siendo
       `pageSize`—, sólo que el bloque empieza en cero. */
    const skip = pagination.accumulate ? 0 : (page - 1) * pageSize;
    const take = pagination.accumulate
      ? Math.min(page * pageSize, MAX_ACCUMULATED)
      : pageSize;

    // En paralelo: son dos consultas independientes.
    const [total, items] = await Promise.all([
      this.delegate.count({ where: fullWhere }),
      this.delegate.findMany({
        where: fullWhere,
        orderBy: stableOrderBy,
        skip,
        take,
        ...(include ? { include } : {}),
      }),
    ]);

    return {
      items: items as T[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }
}
