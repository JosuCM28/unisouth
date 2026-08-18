import type { Lot, LotStatus, Prisma } from "@prisma/client";
import {
  STATUSES_ISSUABLE,
  STATUSES_PHYSICALLY_PRESENT,
} from "@/lib/constants/lot-status";
import { NotFoundError } from "@/lib/core/errors";
import {
  BaseRepository,
  type PaginatedResult,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

export interface LotFilters extends PaginationInput {
  search?: string;
  materialId?: string;
  locationId?: string;
  clientId?: string;
  status?: LotStatus;
  isRemnant?: boolean;
  verified?: boolean;
  /**
   * Los cancelados (WRITTEN_OFF) NO salen en el listado diario: el auxiliar
   * busca rollos que puede tomar, y ver bajas mezcladas con material vivo
   * sólo estorba. Se piden aparte con el filtro "Cancelados".
   */
  includeCancelled?: boolean;
  /**
   * Llegada dentro de los últimos N días.
   *
   * Se recibe como número de días y no como par de fechas porque la pregunta
   * real del piso es "¿qué llegó esta semana?", no un rango arbitrario.
   */
  arrivedWithinDays?: number;
}

export interface AvailableForIssueParams {
  materialId: string;
  /** Dueño del material. La tela de un cliente jamás surte a otro. */
  clientId?: string;
  includeRemnants?: boolean;
}

export class LotRepository extends BaseRepository<
  Lot,
  Prisma.LotCreateInput,
  Prisma.LotUpdateInput
> {
  /**
   * Un rollo NO se borra: cambia de estado.
   *
   * Aunque se agote o se dé de baja, su kárdex debe seguir siendo consultable
   * años después. Por eso no hay `deletedAt` en la tabla y el filtro de
   * "vivos" del padre no aplica aquí.
   */
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.lot;
  }

  protected get entityName(): string {
    return "el rollo";
  }

  async search(filters: LotFilters = {}): Promise<PaginatedResult<Lot>> {
    const where: Prisma.LotWhereInput = {};

    if (filters.search) {
      const search = filters.search;
      // Búsqueda global: el auxiliar tiene el rollo enfrente y teclea lo que
      // alcanza a leer en la etiqueta —folio, partida, tono o el color—, sin
      // saber en qué campo lo guardó el sistema.
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { supplierLotNumber: { contains: search, mode: "insensitive" } },
        { shade: { contains: search, mode: "insensitive" } },
        { colorText: { contains: search, mode: "insensitive" } },
        { comment: { contains: search, mode: "insensitive" } },
        { material: { name: { contains: search, mode: "insensitive" } } },
        { receipt: { guideNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (filters.materialId) where.materialId = filters.materialId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.clientId) where.clientId = filters.clientId;

    // El estado pedido manda: si alguien filtra por "Dado de baja" quiere
    // verlos, y ocultarlos ahí dejaría la pantalla vacía sin explicación.
    if (filters.status) {
      where.status = filters.status;
    } else if (!filters.includeCancelled) {
      where.status = { not: "WRITTEN_OFF" };
    }
    if (filters.arrivedWithinDays && filters.arrivedWithinDays > 0) {
      const since = new Date();
      since.setDate(since.getDate() - filters.arrivedWithinDays);
      where.receivedAt = { gte: since };
    }

    if (filters.isRemnant !== undefined) where.isRemnant = filters.isRemnant;
    if (filters.verified !== undefined) where.verified = filters.verified;

    return this.paginate<Lot>(where, { receivedAt: "desc" }, filters, {
      material: {
        select: {
          id: true,
          code: true,
          name: true,
          baseUnit: true,
          composition: true,
        },
      },
      location: { select: { id: true, code: true, name: true } },
      client: { select: { id: true, name: true } },
    });
  }

  /**
   * Ficha completa del rollo: lo que se ve al escanear su QR.
   *
   * Los movimientos se topan en 50: es el kárdex reciente que cabe en
   * pantalla, no el historial completo.
   */
  async findDetail(code: string) {
    return this.db.lot.findUnique({
      where: { code },
      include: {
        material: true,
        location: true,
        client: true,
        productionRun: true,
        receipt: {
          include: {
            supplier: { select: { id: true, name: true } },
            carrier: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
        movements: {
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        reservations: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          include: {
            productionOrder: { select: { id: true, code: true } },
          },
        },
      },
    });
  }

  /**
   * Rollos de los que se puede surtir, en el orden en que deben ofrecerse.
   *
   * El orden NO es cosmético:
   *  · retazos primero, o se acumulan en una esquina y se vuelven basura;
   *  · luego FIFO por fecha de recepción, para que la tela no envejezca.
   */
  async findAvailableForIssue(params: AvailableForIssueParams) {
    const where: Prisma.LotWhereInput = {
      materialId: params.materialId,
      status: {
        in: params.includeRemnants === false ? ["AVAILABLE"] : [...STATUSES_ISSUABLE],
      },
      isBlocked: false,
      // Sin saldo libre no hay nada que surtir.
      currentQuantity: { gt: 0 },
    };

    // La tela es del cliente que manda a maquilar: surtirle a otro su
    // material es el error más caro que puede cometer el sistema.
    if (params.clientId) {
      where.clientId = params.clientId;
    }

    return this.db.lot.findMany({
      where,
      orderBy: [{ isRemnant: "desc" }, { receivedAt: "asc" }],
      include: {
        material: { select: { id: true, code: true, name: true, baseUnit: true } },
        location: { select: { id: true, code: true, name: true } },
      },
    });
  }

  /**
   * Lo que DE VERDAD se puede surtir hoy: dueños y materiales con existencia.
   *
   * El formulario de salida ofrecía los catálogos completos —26 clientes, 6
   * materiales— cuando sólo 3 dueños y 4 materiales tenían rollos. Elegir
   * cualquiera de los otros devolvía una lista vacía sin explicación, y desde
   * el piso eso se lee como "el sistema no sirve".
   *
   * Se resuelve con un groupBy y no trayendo los rollos: la pantalla sólo
   * necesita saber cuántos hay de cada combinación, no cuáles son.
   */
  async findIssuableOptions() {
    const grouped = await this.db.lot.groupBy({
      by: ["clientId", "materialId"],
      where: {
        status: { in: [...STATUSES_ISSUABLE] },
        isBlocked: false,
        currentQuantity: { gt: 0 },
      },
      _count: { _all: true },
    });

    return grouped.map(
      (row: { clientId: string | null; materialId: string; _count: { _all: number } }) => ({
        clientId: row.clientId,
        materialId: row.materialId,
        count: row._count._all,
      }),
    );
  }

  /** Rollos que ocupan lugar físico en la bodega. */
  async countPhysicallyPresent(): Promise<number> {
    return this.db.lot.count({
      where: { status: { in: [...STATUSES_PHYSICALLY_PRESENT] } },
    });
  }

  /** Metraje que nadie ha confirmado con cinta. */
  async countUnverified(): Promise<number> {
    return this.db.lot.count({
      where: {
        verified: false,
        status: { in: [...STATUSES_PHYSICALLY_PRESENT] },
      },
    });
  }

  async countByStatus(): Promise<Record<string, number>> {
    const grouped = await this.db.lot.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    return Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all]),
    );
  }

  /**
   * Rollos parados más de N días.
   *
   * Se mide contra `updatedAt`, que se mueve con cada movimiento del lote:
   * es el rastro más fiel de "la última vez que alguien lo tocó".
   */
  async countAgedBeyond(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.db.lot.count({
      where: {
        status: { in: [...STATUSES_PHYSICALLY_PRESENT] },
        updatedAt: { lt: cutoff },
      },
    });
  }

  async findByCodeOrThrow(code: string): Promise<Lot> {
    const lot = await this.db.lot.findUnique({ where: { code } });
    if (!lot) throw new NotFoundError(this.entityName, code);
    return lot;
  }
}
