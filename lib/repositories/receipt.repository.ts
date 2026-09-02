import type { Prisma, Receipt, Unit } from "@prisma/client";
import {
  BaseRepository,
  type PaginatedResult,
  type PaginationInput,
  type PrismaDelegate,
} from "@/lib/core/base-repository";
import { EXPORT_ROW_LIMIT } from "@/lib/export/limits";

export interface ReceiptFilters extends PaginationInput {
  search?: string;
  clientId?: string;
  /** La tela que trajo la guía. Vive en los ROLLOS, no en el encabezado. */
  materialId?: string;
  supplierId?: string;
  carrierId?: string;
  /** Llegadas dentro de los últimos N días. */
  arrivedWithinDays?: number;
  /**
   * Rango explícito de fechas de recepción, el del reporte.
   *
   * Manda sobre `arrivedWithinDays`: un rango tecleado a mano es más
   * específico que el chip de "esta semana", y aplicar los dos dejaría fuera
   * justo lo que se acaba de pedir.
   */
  from?: Date;
  to?: Date;
}

/**
 * Cuánto entró de una unidad, y en cuántos rollos.
 *
 * Va por unidad y no como una sola cifra porque sumar metros con piezas da un
 * número que no significa nada: 300 m de tela más 40 cierres no son 340 de
 * nada.
 */
export interface UnitTotal {
  unit: Unit;
  quantity: number;
  lots: number;
}

/**
 * Cuánto entró de UNA tela dentro de UNA guía.
 *
 * Existe porque una recepción puede traer dos telas y el total de la guía no
 * las distingue: "5,502 m" sobre una guía de gabardina y mezclilla no dice
 * cuánto se recibió de cada una, que es justo lo que hay que cuadrar contra
 * la factura.
 *
 * La unidad va en la llave junto con el material: la misma tela capturada en
 * metros y en kilos son dos renglones, no uno con la suma.
 */
export interface MaterialTotal {
  materialId: string;
  name: string;
  code: string;
  unit: Unit;
  quantity: number;
  lots: number;
}

/** Un renglón de desglose del reporte: una tela, un cliente, un proveedor. */
export interface ReportGroupRow {
  key: string;
  label: string;
  /** Subtítulo: el código del material. Vacío cuando no aplica. */
  hint: string;
  lots: number;
  byUnit: UnitTotal[];
  /**
   * Cuántas guías cayeron en el renglón.
   *
   * Opcional porque sólo tiene sentido donde el corte es por ENCABEZADO
   * —periodo, proveedor, paquetería—. Al agrupar por tela una misma guía cae
   * en varios renglones, y contarla en cada uno daría un total de guías que no
   * cuadra con el de arriba.
   */
  receipts?: number;
}

export interface ReceiptReportRows {
  receipts: ReceiptCardData[];
  byMaterial: ReportGroupRow[];
  byClient: ReportGroupRow[];
  /** Se alcanzó el tope de recepciones y las cifras están incompletas. */
  truncated: boolean;
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
  /** El desglose completo, que es lo que necesita el reporte para sumar. */
  byUnit: UnitTotal[];
  /**
   * Cuánto entró de cada tela, de mayor a menor.
   *
   * Es el dato que el total de la guía no puede dar cuando trae dos telas.
   */
  materials: MaterialTotal[];
  /** Los nombres de `materials`, sin repetir. Para títulos y chips. */
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

/**
 * Los catálogos del encabezado. Uno solo para la lista y para el reporte: si
 * se escribieran aparte, agregar un dato a la tarjeta lo dejaría fuera del
 * Excel sin que nada lo advirtiera.
 */
const RECEIPT_INCLUDE = {
  client: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  carrier: { select: { id: true, name: true } },
  recordedBy: { select: { id: true, name: true } },
} satisfies Prisma.ReceiptInclude;

/** Lo que devuelve un `groupBy` de rollos por una llave y su unidad. */
type GroupedLots<K extends string> = {
  [P in K]: string | null;
} & {
  unit: Unit;
  _sum: { initialQuantity: Prisma.Decimal | null };
  _count: { _all: number };
};

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
   *
   * Y también contra la TELA, que es la otra forma de preguntar lo mismo:
   * "¿cuándo llegó la gabardina azul?". El nombre del material vive en los
   * rollos, así que se busca a través de ellos.
   */
  async search(
    filters: ReceiptFilters = {},
  ): Promise<PaginatedResult<ReceiptCardData>> {
    const result = await this.paginate<
      Receipt & {
        client: { id: string; name: string } | null;
        supplier: { id: string; name: string } | null;
        carrier: { id: string; name: string } | null;
        recordedBy: { id: string; name: string } | null;
      }
    >(this.buildWhere(filters), { date: "desc" }, filters, RECEIPT_INCLUDE);

    return {
      ...result,
      items: await this.withLotSummary(result.items, this.buildLotWhere(filters)),
    };
  }

  /**
   * El `where` de la lista.
   *
   * Vive aparte porque el REPORTE filtra igual. Escrito dos veces, el día que
   * alguien agregue un filtro a la pantalla el Excel seguiría trayendo otra
   * cosa —y con las mismas etiquetas arriba, así que nadie lo notaría—.
   */
  private buildWhere(filters: ReceiptFilters): Prisma.ReceiptWhereInput {
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
        // Y por la tela: nombre o código del material de cualquiera de sus
        // rollos. "¿cuándo llegó la gabardina?" es la pregunta de todos los días.
        {
          lots: {
            some: {
              material: { name: { contains: search, mode: "insensitive" } },
            },
          },
        },
        {
          lots: {
            some: {
              material: { code: { contains: search, mode: "insensitive" } },
            },
          },
        },
      ];
    }

    /* Dueño y tela viven los dos en los ROLLOS, así que van en un SOLO `some`
       y no en dos.
       
       Es la diferencia entre "un rollo que es de Ternium Y es mezclilla" y
       "la guía trae algo de Ternium y por otro lado algo de mezclilla": con
       guías compartidas entre dos clientes, lo segundo devolvería recepciones
       donde la mezclilla es del OTRO cliente, que es justo lo que no se puede
       confundir.
       
       Del dueño se filtra por el rollo y no por el encabezado porque una guía
       compartida no tiene dueño arriba, y filtrando por ahí se caería de las
       dos listas justo cuando más importa encontrarla. */
    const lotWhere = this.buildLotWhere(filters);
    if (Object.keys(lotWhere).length > 0) where.lots = { some: lotWhere };
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.carrierId) where.carrierId = filters.carrierId;

    if (filters.from || filters.to) {
      where.date = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    } else if (filters.arrivedWithinDays && filters.arrivedWithinDays > 0) {
      const since = new Date();
      since.setDate(since.getDate() - filters.arrivedWithinDays);
      where.date = { gte: since };
    }

    return where;
  }

  /**
   * El filtro a nivel ROLLO: dueño y tela, que no viven en el encabezado.
   *
   * En la lista sirve para decidir qué guías salen. En el reporte hace algo
   * más: acota lo que se SUMA. Filtrar por "gabardina" y luego sumar la guía
   * completa contestaría "cuánto trajeron los camiones que traían gabardina",
   * que no es lo que nadie preguntó.
   */
  private buildLotWhere(filters: ReceiptFilters): Prisma.LotWhereInput {
    const lotWhere: Prisma.LotWhereInput = {};
    if (filters.clientId) lotWhere.clientId = filters.clientId;
    if (filters.materialId) lotWhere.materialId = filters.materialId;
    return lotWhere;
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
    lotFilter: Prisma.LotWhereInput = {},
  ): Promise<(T & {
    lotCount: number;
    totalQuantity: number;
    unit: Unit | null;
    byUnit: UnitTotal[];
    materials: MaterialTotal[];
    materialNames: string[];
    ownerNames: string[];
  })[]> {
    if (receipts.length === 0) return [];

    const ids = receipts.map((receipt) => receipt.id);
    const where: Prisma.LotWhereInput = { receiptId: { in: ids }, ...lotFilter };

    const [sums, materials, owners] = await Promise.all([
      this.db.lot.groupBy({
        by: ["receiptId", "unit"],
        where,
        _sum: { initialQuantity: true },
        // El conteo sale de aquí y no de un `_count` sobre la recepción: con
        // filtro de tela, el `_count` traería los rollos de TODA la guía y el
        // renglón diría "12 rollos" junto a los metros de sólo 3.
        _count: { _all: true },
      }),
      /* Agrupado y no `distinct`: antes sólo se traían los NOMBRES de las
         telas de cada guía, y con eso la tarjeta decía "gabardina · mezclilla"
         junto a un único total que no distinguía cuánto era de cada una.
         Sumar aquí cuesta lo mismo —lo hace Postgres— y da la cifra que hay
         que cuadrar contra la factura. */
      this.db.lot.groupBy({
        by: ["receiptId", "materialId", "unit"],
        where,
        _sum: { initialQuantity: true },
        _count: { _all: true },
      }),
      /* Los dueños salen de los ROLLOS, que es donde vive el dato. `distinct`
         por recepción y cliente para traer un renglón por dueño y no los
         veinte rollos de una guía sólo para quedarnos con un nombre. */
      this.db.lot.findMany({
        where,
        distinct: ["receiptId", "clientId"],
        select: {
          receiptId: true,
          client: { select: { name: true } },
        },
      }),
    ]);

    const totals = new Map<string, UnitTotal[]>();
    for (const row of sums as {
      receiptId: string | null;
      unit: Unit;
      _sum: { initialQuantity: Prisma.Decimal | null };
      _count: { _all: number };
    }[]) {
      if (!row.receiptId) continue;
      const current = totals.get(row.receiptId) ?? [];
      current.push({
        unit: row.unit,
        quantity: Number(row._sum.initialQuantity ?? 0),
        lots: row._count._all,
      });
      totals.set(row.receiptId, current);
    }

    const materialRows = materials as (GroupedLots<"materialId"> & {
      receiptId: string | null;
    })[];

    // Los nombres se piden UNA vez para toda la página, no por recepción.
    const byMaterialId = await this.materialsById(
      materialRows.map((row) => row.materialId),
    );

    const byReceipt = new Map<string, MaterialTotal[]>();
    for (const row of materialRows) {
      if (!row.receiptId || !row.materialId) continue;
      const material = byMaterialId.get(row.materialId);

      byReceipt.set(row.receiptId, [
        ...(byReceipt.get(row.receiptId) ?? []),
        {
          materialId: row.materialId,
          // Una tela dada de baja después de recibirla no borra lo que llegó
          // con ella: el renglón se queda, nombrado como lo que es.
          name: material?.name ?? "(material borrado)",
          code: material?.code ?? "",
          unit: row.unit,
          quantity: Number(row._sum.initialQuantity ?? 0),
          lots: row._count._all,
        },
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

    return receipts.map((receipt) => {
      // De mayor a menor: la unidad principal de la guía es de la que más
      // entró, y es la que se pinta grande en la tarjeta.
      const byUnit = (totals.get(receipt.id) ?? []).sort(
        (a, b) => b.quantity - a.quantity,
      );

      // La tela de la que más llegó, primero: es la que da nombre a la guía.
      const materials = (byReceipt.get(receipt.id) ?? []).sort(
        (a, b) => b.quantity - a.quantity,
      );

      return {
        ...receipt,
        lotCount: byUnit.reduce((sum, item) => sum + item.lots, 0),
        /* La tarjeta enseña UNA cifra con UNA unidad: una recepción no mezcla
           metros con piezas, y si lo hiciera el total ya no sería un número
           que se pueda sumar. El desglose completo va en `byUnit`. */
        totalQuantity: byUnit[0]?.quantity ?? 0,
        unit: byUnit[0]?.unit ?? null,
        byUnit,
        materials,
        /* Sin repetir: una tela recibida en metros Y en kilos son dos
           renglones en `materials`, pero un solo nombre en la tarjeta. */
        materialNames: [...new Set(materials.map((item) => item.name))],
        ownerNames: ownerNames.get(receipt.id) ?? [],
      };
    });
  }

  /** Nombre y código de un puñado de telas, en una sola consulta. */
  private async materialsById(
    ids: (string | null)[],
  ): Promise<Map<string, { name: string; code: string }>> {
    const unique = [...new Set(ids)].filter((id): id is string => Boolean(id));
    if (unique.length === 0) return new Map();

    const materials = await this.db.material.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, code: true },
    });

    return new Map(materials.map((item) => [item.id, item]));
  }

  /**
   * Todo lo que necesita el reporte global, sin paginar.
   *
   * Las recepciones vienen completas porque de ellas salen los cortes por
   * periodo, por proveedor y por paquetería —tres agrupaciones sobre el mismo
   * encabezado, que no vale la pena pedirle tres veces a Postgres—, mientras
   * que tela y dueño sí se agregan en la base: viven en los rollos y traerlos
   * todos sería mover el almacén entero por la red.
   *
   * `limit` no es adorno: un rango de cinco años sin filtro traería miles de
   * encabezados. Se pide uno de más para poder AVISAR que se topó, en vez de
   * entregar un reporte incompleto que se ve igual de correcto.
   */
  async findReportData(
    filters: ReceiptFilters,
    limit: number,
  ): Promise<ReceiptReportRows> {
    const where = this.buildWhere(filters);
    const lotWhere: Prisma.LotWhereInput = {
      receipt: { is: where },
      ...this.buildLotWhere(filters),
    };

    const [list, materialGroups, clientGroups] = await Promise.all([
      this.findAllForExport(filters, limit),
      this.db.lot.groupBy({
        by: ["materialId", "unit"],
        where: lotWhere,
        _sum: { initialQuantity: true },
        _count: { _all: true },
      }),
      this.db.lot.groupBy({
        by: ["clientId", "unit"],
        where: lotWhere,
        _sum: { initialQuantity: true },
        _count: { _all: true },
      }),
    ]);

    const [byMaterial, byClient] = await Promise.all([
      this.labelMaterialGroups(materialGroups as GroupedLots<"materialId">[]),
      this.labelClientGroups(clientGroups as GroupedLots<"clientId">[]),
    ]);

    return {
      receipts: list.items,
      byMaterial,
      byClient,
      truncated: list.truncated,
    };
  }

  /**
   * La lista COMPLETA que casa con el filtro, sin paginar.
   *
   * Es lo que baja el botón de Excel de la pantalla de recepciones, y también
   * el punto de partida del reporte: los dos tienen que estar mirando
   * exactamente el mismo conjunto de guías.
   *
   * Pide una fila de más para poder distinguir "cabe justo" de "se topó", y
   * así avisarlo en vez de entregar un archivo corto que se ve completo.
   */
  async findAllForExport(
    filters: ReceiptFilters,
    limit: number = EXPORT_ROW_LIMIT,
  ): Promise<{ items: ReceiptCardData[]; truncated: boolean }> {
    const rows = await this.db.receipt.findMany({
      where: this.buildWhere(filters),
      // El mismo orden que la lista, con desempate: sin él, dos guías del
      // mismo día pueden salir en distinto orden en cada descarga.
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: RECEIPT_INCLUDE,
    });

    const page = rows.slice(0, limit) as (Receipt & {
      client: { id: string; name: string } | null;
      supplier: { id: string; name: string } | null;
      carrier: { id: string; name: string } | null;
      recordedBy: { id: string; name: string } | null;
    })[];

    return {
      items: await this.withLotSummary(page, this.buildLotWhere(filters)),
      truncated: rows.length > limit,
    };
  }

  /** Le pone nombre y código a lo que Postgres agrupó por id. */
  private async labelMaterialGroups(
    groups: GroupedLots<"materialId">[],
  ): Promise<ReportGroupRow[]> {
    const byId = await this.materialsById(groups.map((row) => row.materialId));

    return foldGroups(groups, "materialId", (id) => ({
      // El material puede haberse dado de baja después de recibirlo: el
      // renglón se queda con su cantidad en vez de desaparecer del reporte.
      label: byId.get(id ?? "")?.name ?? "(material borrado)",
      hint: byId.get(id ?? "")?.code ?? "",
    }));
  }

  private async labelClientGroups(
    groups: GroupedLots<"clientId">[],
  ): Promise<ReportGroupRow[]> {
    const ids = [...new Set(groups.map((row) => row.clientId))].filter(
      (id): id is string => Boolean(id),
    );

    const clients =
      ids.length > 0
        ? await this.db.client.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          })
        : [];
    const byId = new Map(clients.map((client) => [client.id, client]));

    return foldGroups(groups, "clientId", (id) => ({
      // Sin cliente no es un hueco: es tela de la fábrica, y se nombra.
      label: id ? (byId.get(id)?.name ?? "(cliente borrado)") : "De la fábrica",
      hint: "",
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
    const [clients, suppliers, carriers, materials] = await Promise.all([
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
      /* Sólo telas que de verdad llegaron en alguna recepción: ofrecer el
         catálogo entero llenaría el selector de materiales que no devuelven
         nada. El código va aparte para poder enseñarlo de subtítulo, que es
         lo que trae impreso la etiqueta del rollo. */
      this.db.material.findMany({
        where: { lots: { some: { receiptId: { not: null } } } },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return { clients, suppliers, carriers, materials };
  }
}

/**
 * Junta los renglones de un `groupBy` en un desglose por llave.
 *
 * Postgres devuelve un renglón por (llave, unidad); aquí se pliegan a uno por
 * llave con su lista de unidades dentro, que es como se lee: "gabardina azul,
 * 5,500 m en 22 rollos".
 */
function foldGroups<K extends string>(
  groups: GroupedLots<K>[],
  key: K,
  describe: (id: string | null) => { label: string; hint: string },
): ReportGroupRow[] {
  const buckets = new Map<string, ReportGroupRow>();

  for (const row of groups) {
    const id = row[key] as string | null;
    // Sin id sigue siendo un renglón: "de la fábrica" es una respuesta, no un
    // hueco, y omitirlo haría que los desgloses no cuadren con el total.
    const bucketKey = id ?? "__none__";

    const bucket = buckets.get(bucketKey) ?? {
      key: bucketKey,
      ...describe(id),
      lots: 0,
      byUnit: [],
    };

    bucket.lots += row._count._all;
    bucket.byUnit.push({
      unit: row.unit,
      quantity: Number(row._sum.initialQuantity ?? 0),
      lots: row._count._all,
    });

    buckets.set(bucketKey, bucket);
  }

  return sortGroups([...buckets.values()]);
}

/**
 * De mayor a menor por la unidad principal de cada renglón.
 *
 * No se suman las unidades para ordenar: una tela de 5,000 m tiene que ir
 * arriba de una caja de 8,000 botones, y sumarlas pondría los botones
 * primero. Se compara contra la cantidad más grande de cada uno, que es la
 * que la gente tiene en la cabeza cuando dice "de lo que más llegó".
 */
export function sortGroups(rows: ReportGroupRow[]): ReportGroupRow[] {
  for (const row of rows) row.byUnit.sort((a, b) => b.quantity - a.quantity);
  return rows.sort((a, b) => (b.byUnit[0]?.quantity ?? 0) - (a.byUnit[0]?.quantity ?? 0));
}
