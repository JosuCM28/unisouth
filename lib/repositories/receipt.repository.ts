import type { Prisma, Receipt, Unit } from "@prisma/client";
import {
  BaseRepository,
  type PaginatedResult,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

export interface ReceiptFilters extends PaginationInput {
  search?: string;
  clientId?: string;
  supplierId?: string;
  carrierId?: string;
  /** Llegadas dentro de los últimos N días. */
  arrivedWithinDays?: number;
}

/** Encabezado + cuántos rollos trajo. Es lo que pinta cada tarjeta. */
export interface ReceiptCardData extends Receipt {
  client: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  carrier: { id: string; name: string } | null;
  recordedBy: { id: string; name: string } | null;
  lotCount: number;
  /**
   * Metraje que entró con esta guía y qué tela era.
   *
   * Se resuelven aquí y no al abrir el detalle porque son las dos cosas que
   * de verdad identifican una recepción: "los 5,502 m de Lincon verde". Sin
   * ellas, la lista obliga a abrir una por una para saber cuál es cuál.
   */
  totalQuantity: number;
  unit: Unit | null;
  materialNames: string[];
  /**
   * Los dueños de sus rollos, sin repetir.
   *
   * Van en plural porque una guía puede traer tela de dos clientes; en ese
   * caso el `clientId` del encabezado queda vacío y pintar la tarjeta desde
   * ahí diría "de la fábrica" sobre material que sí tiene dueño.
   */
  ownerNames: string[];
}

export class ReceiptRepository extends BaseRepository<
  Receipt,
  Prisma.ReceiptCreateInput,
  Prisma.ReceiptUpdateInput
> {
  /**
   * Una recepción no se borra ni se da de baja: es el acta de lo que entró
   * por la puerta ese día. La tabla no tiene `deletedAt`, así que el filtro
   * de "vivos" del padre no aplica.
   */
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.receipt;
  }

  protected get entityName(): string {
    return "la recepción";
  }

  /**
   * Listado de recepciones, de la más reciente a la más vieja.
   *
   * La búsqueda pega contra guía, folio y factura porque ésa es justo la
   * pregunta del piso: "¿qué llegó en la guía tal?". Quien pregunta trae el
   * número en un papel y no sabe —ni le importa— en qué campo lo guardamos.
   */
  async search(
    filters: ReceiptFilters = {},
  ): Promise<PaginatedResult<ReceiptCardData>> {
    const where: Prisma.ReceiptWhereInput = {};

    if (filters.search) {
      const search = filters.search;
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { guideNumber: { contains: search, mode: "insensitive" } },
        { invoiceRef: { contains: search, mode: "insensitive" } },
        { orderRef: { contains: search, mode: "insensitive" } },
        { origin: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { carrier: { name: { contains: search, mode: "insensitive" } } },
        { supplier: { name: { contains: search, mode: "insensitive" } } },
        { client: { name: { contains: search, mode: "insensitive" } } },
        // También por el folio del rollo: a veces lo que trae en la mano es
        // la etiqueta de un rollo y quiere ver con qué más llegó.
        { lots: { some: { code: { contains: search, mode: "insensitive" } } } },
      ];
    }

    /* Se filtra por el dueño de los ROLLOS y no por el del encabezado: una
       guía compartida entre dos clientes no tiene dueño en el encabezado, y
       filtrando por ahí se caería de las dos listas justo cuando más importa
       encontrarla. Así aparece bajo los dos. */
    if (filters.clientId) where.lots = { some: { clientId: filters.clientId } };
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.carrierId) where.carrierId = filters.carrierId;

    if (filters.arrivedWithinDays && filters.arrivedWithinDays > 0) {
      const since = new Date();
      since.setDate(since.getDate() - filters.arrivedWithinDays);
      where.date = { gte: since };
    }

    const result = await this.paginate<
      Receipt & {
        client: { id: string; name: string } | null;
        supplier: { id: string; name: string } | null;
        carrier: { id: string; name: string } | null;
        recordedBy: { id: string; name: string } | null;
        _count: { lots: number };
      }
    >(where, { date: "desc" }, filters, {
      client: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      carrier: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
      // El conteo lo hace Postgres: traer los rollos sólo para contarlos
      // movería toda la tabla por la red en cada carga de pantalla.
      _count: { select: { lots: true } },
    });

    const base = result.items.map(({ _count, ...receipt }) => ({
      ...receipt,
      lotCount: _count.lots,
    }));

    return { ...result, items: await this.withLotSummary(base) };
  }

  /**
   * Agrega metraje y tela a cada recepción de la página.
   *
   * Va en DOS consultas agrupadas sobre la página completa, no una por
   * recepción: con 50 filas serían 100 viajes a Neon y la lista tardaría
   * segundos en pintar desde el celular.
   *
   * Se suma `initialQuantity` y no `currentQuantity` porque la pregunta es
   * "cuánto ENTRÓ con esta guía". El saldo de hoy ya bajó por los cortes, y
   * usarlo haría que una recepción vieja pareciera haber traído menos tela
   * de la que de verdad se bajó del camión.
   */
  private async withLotSummary<T extends { id: string }>(
    receipts: T[],
  ): Promise<(T & {
    totalQuantity: number;
    unit: Unit | null;
    materialNames: string[];
    ownerNames: string[];
  })[]> {
    if (receipts.length === 0) return [];

    const ids = receipts.map((receipt) => receipt.id);

    const [sums, materials, owners] = await Promise.all([
      this.db.lot.groupBy({
        by: ["receiptId", "unit"],
        where: { receiptId: { in: ids } },
        _sum: { initialQuantity: true },
      }),
      this.db.lot.findMany({
        where: { receiptId: { in: ids } },
        distinct: ["receiptId", "materialId"],
        select: {
          receiptId: true,
          material: { select: { name: true } },
        },
      }),
      /* Los dueños salen de los ROLLOS, que es donde vive el dato. `distinct`
         por recepción y cliente para traer un renglón por dueño y no los
         veinte rollos de una guía sólo para quedarnos con un nombre. */
      this.db.lot.findMany({
        where: { receiptId: { in: ids } },
        distinct: ["receiptId", "clientId"],
        select: {
          receiptId: true,
          client: { select: { name: true } },
        },
      }),
    ]);

    const totals = new Map<string, { quantity: number; unit: Unit | null }>();
    for (const row of sums as {
      receiptId: string | null;
      unit: Unit;
      _sum: { initialQuantity: Prisma.Decimal | null };
    }[]) {
      if (!row.receiptId) continue;
      const current = totals.get(row.receiptId) ?? { quantity: 0, unit: null };
      current.quantity += Number(row._sum.initialQuantity ?? 0);
      // La unidad de la primera partida: una recepción no mezcla metros con
      // piezas, y si lo hiciera el total ya no sería un número que sumar.
      current.unit = current.unit ?? row.unit;
      totals.set(row.receiptId, current);
    }

    const names = new Map<string, string[]>();
    for (const row of materials as {
      receiptId: string | null;
      material: { name: string };
    }[]) {
      if (!row.receiptId) continue;
      names.set(row.receiptId, [
        ...(names.get(row.receiptId) ?? []),
        row.material.name,
      ]);
    }

    const ownerNames = new Map<string, string[]>();
    for (const row of owners as {
      receiptId: string | null;
      client: { name: string } | null;
    }[]) {
      if (!row.receiptId) continue;
      // Sin cliente = tela de la fábrica. Se nombra en vez de omitirse: una
      // guía mitad de un cliente y mitad de la fábrica tiene que decir las dos.
      ownerNames.set(row.receiptId, [
        ...(ownerNames.get(row.receiptId) ?? []),
        row.client?.name ?? "De la fábrica",
      ]);
    }

    return receipts.map((receipt) => ({
      ...receipt,
      totalQuantity: totals.get(receipt.id)?.quantity ?? 0,
      unit: totals.get(receipt.id)?.unit ?? null,
      materialNames: names.get(receipt.id) ?? [],
      ownerNames: ownerNames.get(receipt.id) ?? [],
    }));
  }

  /**
   * Una recepción con TODOS sus rollos: es la vista de detalle.
   *
   * Los rollos vienen ordenados por folio, que es el orden en que se
   * capturaron y en el que vienen apilados en la tarima.
   */
  async findByCodeWithLots(code: string) {
    return this.db.receipt.findFirst({
      where: { code },
      include: {
        client: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        carrier: { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true } },
        lots: {
          orderBy: { code: "asc" },
          include: {
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
            helper: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  /** Opciones para los <Select> de filtros: sólo lo que ya se usó. */
  /**
   * Catálogos para EDITAR una recepción.
   *
   * A diferencia de `findFilterOptions`, aquí van todos los activos y no sólo
   * los que ya tienen recepciones: al corregir una guía justamente puede
   * hacer falta asignarle una paquetería que nunca se había usado.
   */
  async findEditOptions() {
    const [clients, suppliers, carriers] = await Promise.all([
      this.db.client.findMany({
        where: { deletedAt: null, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.db.supplier.findMany({
        where: { deletedAt: null, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.db.carrier.findMany({
        where: { deletedAt: null, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return { clients, suppliers, carriers };
  }

  async findFilterOptions() {
    const [clients, suppliers, carriers] = await Promise.all([
      this.db.client.findMany({
        where: { lots: { some: {} } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.db.supplier.findMany({
        where: { receipts: { some: {} } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.db.carrier.findMany({
        where: { receipts: { some: {} } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return { clients, suppliers, carriers };
  }
}
