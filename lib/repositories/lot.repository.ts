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
  /**
   * Color, mirando los DOS lados.
   *
   * El color vive en el catálogo (`Material.colorName`) pero el rollo puede
   * traer el suyo capturado a mano (`Lot.colorText`) cuando la partida salió
   * distinta a la ficha. Filtrar sólo por el catálogo escondería justo esos
   * rollos, que son los que se andan buscando.
   */
  colorName?: string;
  /**
   * Tono o partida de tintura.
   *
   * Es exacto y no "contiene": el tono es una clave (A-42), y traer el A-420
   * al pedir el A-42 sería ofrecer tela que no se puede tender junta.
   */
  shade?: string;
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

    /* El color va en un AND propio y NO en `where.OR`.
       Ese OR ya lo ocupa el buscador de arriba; meter aquí otra rama lo
       ensancharía en vez de acotarlo, y buscar "azul" con filtro de color
       traería también los rollos de otro color cuyo folio dijera "azul". */
    if (filters.colorName) {
      const color = filters.colorName;
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { colorText: { equals: color, mode: "insensitive" } },
            // Del catálogo sólo cuando el rollo no traiga el suyo: si lo
            // trae, ése manda y el del material ya no describe esta pieza.
            {
              colorText: null,
              material: { colorName: { equals: color, mode: "insensitive" } },
            },
          ],
        },
      ];
    }

    /* Igualdad exacta salvo por mayúsculas.
       Exacta porque el tono es una clave: traer el A-420 al pedir el A-42
       sería ofrecer tela que no se puede tender junta. Pero insensible a
       mayúsculas porque en la base conviven "Blanco" y "BLANCO" según quién
       capturó, y el desplegable ofrece una sola opción para los dos. */
    if (filters.shade) {
      where.shade = { equals: filters.shade, mode: "insensitive" };
    }

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
          /* El folio desempata, no el id: varios movimientos de la misma
             transacción comparten `createdAt` al milisegundo, y `MOV-2026-…`
             es un correlativo con ceros a la izquierda, así que ordenarlo
             como texto da el orden real de captura. Con un empate sin
             desempate, `take: 50` podía recortar por en medio. */
          orderBy: [{ createdAt: "desc" }, { code: "desc" }],
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

  /**
   * Colores y tonos que DE VERDAD hay en bodega.
   *
   * Se sacan de la existencia y no del catálogo a propósito: un desplegable
   * con treinta colores de los que sólo quedan cuatro obliga a probar uno por
   * uno para descubrir cuáles traen algo. Aquí, todo lo que aparece en la
   * lista devuelve por lo menos un rollo.
   *
   * Acotado por material cuando se pide desde la ficha de una pila: ahí los
   * tonos de otras telas no son una opción, son ruido.
   */
  async findFilterOptions(materialId?: string): Promise<{
    colors: string[];
    shades: string[];
  }> {
    const where = {
      status: { in: [...STATUSES_PHYSICALLY_PRESENT] },
      ...(materialId ? { materialId } : {}),
    };

    const rows = await this.db.lot.findMany({
      where,
      select: {
        colorText: true,
        shade: true,
        material: { select: { colorName: true } },
      },
    });

    /* Se agrupan sin distinguir mayúsculas.
       En la base conviven "Blanco" y "BLANCO" según quién capturó el
       material. El filtro ya es insensible, así que listarlos por separado
       daría dos opciones que devuelven exactamente lo mismo. Se conserva la
       primera forma vista, que es la que el auxiliar reconoce. */
    const colors = new Map<string, string>();
    const shades = new Map<string, string>();

    for (const row of rows) {
      // El del rollo gana sobre el del catálogo: si la partida salió de otro
      // color, ése es el color que tiene la pieza enfrente.
      const color = row.colorText?.trim() || row.material?.colorName?.trim();
      if (color && !colors.has(color.toLowerCase())) {
        colors.set(color.toLowerCase(), color);
      }

      const shade = row.shade?.trim();
      if (shade && !shades.has(shade.toLowerCase())) {
        shades.set(shade.toLowerCase(), shade);
      }
    }

    return {
      colors: [...colors.values()].sort((a, b) => a.localeCompare(b, "es-MX")),
      // Los tonos son claves correlativas (A-42, A-43): el orden natural
      // agrupa la misma serie, que es como se piden en el piso.
      shades: [...shades.values()].sort((a, b) =>
        a.localeCompare(b, "es-MX", { numeric: true }),
      ),
    };
  }
}
