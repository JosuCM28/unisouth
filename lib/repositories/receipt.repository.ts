import type { Prisma, Receipt } from "@prisma/client";
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

    if (filters.clientId) where.clientId = filters.clientId;
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

    return {
      ...result,
      items: result.items.map(({ _count, ...receipt }) => ({
        ...receipt,
        lotCount: _count.lots,
      })),
    };
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
