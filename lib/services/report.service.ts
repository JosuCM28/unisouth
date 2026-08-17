import {
  STATUSES_PHYSICALLY_PRESENT,
  PHYSICALLY_PRESENT_FILTER,
} from "@/lib/constants/lot-status";
import { prisma } from "@/lib/prisma";

/**
 * Tipos de movimiento que representan consumo real de producción.
 *
 * Deliberadamente NO incluye los ajustes ni las mermas: un ajuste corrige un
 * error de captura y una merma es desperdicio. Mezclarlos con el consumo
 * inflaría la cifra y haría ver a una producción como más gastadora de lo
 * que realmente fue.
 */
const CONSUMPTION_TYPES = ["ISSUE_PRODUCTION"] as const;

/** Lo que suma existencias: compras, altas iniciales y devoluciones. */
const INBOUND_TYPES = [
  "RECEIPT_PURCHASE",
  "RECEIPT_INITIAL",
  "RECEIPT_PRODUCTION_RETURN",
] as const;

/** Lo que resta existencias por uso real, sin contar ajustes. */
const OUTBOUND_TYPES = [
  "ISSUE_PRODUCTION",
  "ISSUE_SAMPLE",
  "ISSUE_SCRAP",
  "ISSUE_SUPPLIER_RETURN",
] as const;

const STALE_DAYS = 90;
const FLOW_MONTHS = 6;

export interface ProducedRankRow {
  productionRunId: string;
  productionRunName: string;
  clientName: string;
  quantity: number;
  movements: number;
}

export interface ConsumptionByClientRow {
  clientId: string | null;
  clientName: string;
  quantity: number;
}

export interface FlowRow {
  /** Clave "2026-08", para ordenar sin ambigüedad. */
  month: string;
  label: string;
  inbound: number;
  outbound: number;
}

export interface AlertRow {
  key: string;
  label: string;
  count: number;
  detail: string;
}

export interface ReportSummary {
  /** Rango efectivo del reporte: la hoja impresa debe declararlo. */
  from: Date;
  to: Date;
  totalConsumed: number;
  totalReceived: number;
  activeRuns: number;
  lotsInWarehouse: number;
}

export interface ReportData {
  summary: ReportSummary;
  ranking: ProducedRankRow[];
  byClient: ConsumptionByClientRow[];
  flow: FlowRow[];
  alerts: AlertRow[];
}

const MONTH_LABELS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * Lecturas del tablero de reportes.
 *
 * No extiende BaseService por lo mismo que DashboardService: sólo consulta,
 * no genera folios ni audita, así que arrastrar esa maquinaria sería peso
 * muerto.
 *
 * Las cifras se calculan en la base con groupBy siempre que se puede. Traer
 * los movimientos y sumarlos en memoria funcionaría hoy con tres rollos,
 * pero con dos años de kárdex sería mover toda la tabla por la red en cada
 * carga de pantalla.
 */
export class ReportService {
  /**
   * Todo el reporte de un rango, en paralelo.
   *
   * @param days Ventana hacia atrás: 30 es "el mes", 365 es "el año".
   */
  async getReport(days: number): Promise<ReportData> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    const [ranking, byClient, flow, alerts, summary] = await Promise.all([
      this.getProducedRanking(from),
      this.getConsumptionByClient(from),
      this.getFlow(),
      this.getAlerts(),
      this.getSummary(from),
    ]);

    return { summary: { ...summary, from, to }, ranking, byClient, flow, alerts };
  }

  /**
   * Cuánto material se fue a cada producción, de mayor a menor.
   *
   * De esta única lista salen "lo más producido", "lo menos" y el punto
   * medio: son tres lecturas del mismo orden, y calcularlas por separado
   * daría tres veces el mismo trabajo a Postgres.
   */
  private async getProducedRanking(from: Date): Promise<ProducedRankRow[]> {
    const grouped = await prisma.movement.groupBy({
      by: ["productionRunId"],
      where: {
        type: { in: [...CONSUMPTION_TYPES] },
        createdAt: { gte: from },
        productionRunId: { not: null },
      },
      _sum: { quantity: true },
      _count: { _all: true },
    });

    if (grouped.length === 0) return [];

    const runs = await prisma.productionRun.findMany({
      where: { id: { in: grouped.map((row) => row.productionRunId as string) } },
      select: { id: true, name: true, client: { select: { name: true } } },
    });

    const runById = new Map(runs.map((run) => [run.id, run]));

    return grouped
      .map((row) => {
        const run = runById.get(row.productionRunId as string);
        return {
          productionRunId: row.productionRunId as string,
          productionRunName: run?.name ?? "(producción borrada)",
          clientName: run?.client.name ?? "—",
          // Las salidas se guardan en negativo; se presentan en positivo
          // porque "consumió -300 m" no se lee bien en una junta.
          quantity: Math.abs(Number(row._sum.quantity ?? 0)),
          movements: row._count._all,
        };
      })
      .sort((a, b) => b.quantity - a.quantity);
  }

  /**
   * Consumo agrupado por cliente DUEÑO del material.
   *
   * El dueño vive en el lote, no en el movimiento, así que no hay groupBy
   * directo: se traen los movimientos del rango con su lote y se agrupan
   * aquí. Es el único punto del servicio que suma en memoria, y se limita al
   * rango pedido justo por eso.
   */
  private async getConsumptionByClient(
    from: Date,
  ): Promise<ConsumptionByClientRow[]> {
    const movements = await prisma.movement.findMany({
      where: {
        type: { in: [...CONSUMPTION_TYPES] },
        createdAt: { gte: from },
      },
      select: {
        quantity: true,
        lot: { select: { client: { select: { id: true, name: true } } } },
      },
    });

    const totals = new Map<string, ConsumptionByClientRow>();

    for (const movement of movements) {
      const client = movement.lot?.client;
      const key = client?.id ?? "__factory__";

      const current = totals.get(key) ?? {
        clientId: client?.id ?? null,
        clientName: client?.name ?? "De la fábrica",
        quantity: 0,
      };

      current.quantity += Math.abs(Number(movement.quantity));
      totals.set(key, current);
    }

    return [...totals.values()].sort((a, b) => b.quantity - a.quantity);
  }

  /**
   * Entradas contra salidas, mes a mes.
   *
   * Se agrupa en JS porque Prisma no sabe agrupar por mes sin SQL crudo, y
   * seis meses de movimientos es un volumen que sí cabe en memoria.
   */
  private async getFlow(): Promise<FlowRow[]> {
    const from = new Date();
    from.setMonth(from.getMonth() - (FLOW_MONTHS - 1));
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    const movements = await prisma.movement.findMany({
      where: {
        createdAt: { gte: from },
        type: { in: [...INBOUND_TYPES, ...OUTBOUND_TYPES] },
      },
      select: { createdAt: true, quantity: true, type: true },
    });

    // Se siembran los seis meses aunque estén vacíos: una gráfica que salta
    // de marzo a agosto miente sobre el ritmo real del almacén.
    const buckets = new Map<string, FlowRow>();
    const cursor = new Date(from);

    for (let index = 0; index < FLOW_MONTHS; index += 1) {
      const key = monthKey(cursor);
      buckets.set(key, {
        month: key,
        label: `${MONTH_LABELS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
        inbound: 0,
        outbound: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const inboundTypes = new Set<string>(INBOUND_TYPES);

    for (const movement of movements) {
      const bucket = buckets.get(monthKey(movement.createdAt));
      if (!bucket) continue;

      const amount = Math.abs(Number(movement.quantity));
      if (inboundTypes.has(movement.type)) bucket.inbound += amount;
      else bucket.outbound += amount;
    }

    return [...buckets.values()];
  }

  /** Lo que cuesta dinero sin que se note. */
  private async getAlerts(): Promise<AlertRow[]> {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - STALE_DAYS);

    const [stale, remnants, unverified, blocked] = await Promise.all([
      prisma.lot.count({
        where: {
          status: PHYSICALLY_PRESENT_FILTER,
          updatedAt: { lt: staleDate },
        },
      }),
      prisma.lot.count({
        where: { isRemnant: true, status: PHYSICALLY_PRESENT_FILTER },
      }),
      prisma.lot.count({
        where: { verified: false, status: PHYSICALLY_PRESENT_FILTER },
      }),
      prisma.lot.count({
        where: { isBlocked: true, status: PHYSICALLY_PRESENT_FILTER },
      }),
    ]);

    return [
      {
        key: "stale",
        label: `Sin moverse en ${STALE_DAYS} días`,
        count: stale,
        detail: "Material parado que ocupa lugar y no rota.",
      },
      {
        key: "remnants",
        label: "Retazos acumulados",
        count: remnants,
        detail: "Se ofrecen primero al surtir; si crecen, no se están usando.",
      },
      {
        key: "unverified",
        label: "Sin medir",
        count: unverified,
        detail: "El saldo es el de la etiqueta del proveedor, nadie lo midió.",
      },
      {
        key: "blocked",
        label: "Bloqueados",
        count: blocked,
        detail: "Retenidos: no se pueden surtir hasta liberarlos.",
      },
    ];
  }

  private async getSummary(
    from: Date,
  ): Promise<Omit<ReportSummary, "from" | "to">> {
    const [consumed, received, activeRuns, lotsInWarehouse] = await Promise.all([
      prisma.movement.aggregate({
        where: { type: { in: [...CONSUMPTION_TYPES] }, createdAt: { gte: from } },
        _sum: { quantity: true },
      }),
      prisma.movement.aggregate({
        where: { type: { in: [...INBOUND_TYPES] }, createdAt: { gte: from } },
        _sum: { quantity: true },
      }),
      prisma.productionRun.count({ where: { status: "ACTIVE" } }),
      prisma.lot.count({
        where: { status: { in: [...STATUSES_PHYSICALLY_PRESENT] } },
      }),
    ]);

    return {
      totalConsumed: Math.abs(Number(consumed._sum.quantity ?? 0)),
      totalReceived: Math.abs(Number(received._sum.quantity ?? 0)),
      activeRuns,
      lotsInWarehouse,
    };
  }
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
