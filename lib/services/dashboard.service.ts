import {
  STATUSES_CONSUMED,
  STATUSES_PHYSICALLY_PRESENT,
} from "@/lib/constants/lot-status";
import { prisma } from "@/lib/prisma";

export interface DashboardKpis {
  lotesEnBodega: number;
  retazos: number;
  sinMover90Dias: number;
  materialesBajoReorden: number;
  movimientosHoy: number;
  calculosConFaltante: number;
  requisicionesAbiertas: number;
}

export interface StockByClient {
  clientId: string | null;
  clientName: string;
  lots: number;
  quantity: number;
}

export interface RecentMovement {
  id: string;
  code: string;
  type: string;
  quantity: number;
  unit: string;
  createdAt: Date;
  lotCode: string;
  materialName: string;
  userName: string | null;
}

/** Requisiciones que todavía esperan algo de alguien. */
const OPEN_PURCHASE_REQUEST_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "ORDERED",
  "PARTIALLY_RECEIVED",
] as const;

const STALE_DAYS = 90;

/**
 * Lecturas del tablero.
 *
 * No extiende BaseService porque no escribe nada: no genera folios, no audita
 * y no abre transacciones. Es sólo consulta, así que arrastrar esa maquinaria
 * sería peso muerto.
 */
export class DashboardService {
  /**
   * Las 7 cifras del tablero, todas en paralelo.
   *
   * En serie serían 7 viajes a Neon encadenados y el tablero tardaría
   * segundos en pintar desde el celular.
   */
  async getKpis(): Promise<DashboardKpis> {
    const [
      lotesEnBodega,
      retazos,
      sinMover90Dias,
      materialesBajoReorden,
      movimientosHoy,
      calculosConFaltante,
      requisicionesAbiertas,
    ] = await Promise.all([
      prisma.lot.count({
        where: { status: { in: [...STATUSES_PHYSICALLY_PRESENT] } },
      }),

      prisma.lot.count({
        where: { isRemnant: true, status: { notIn: [...STATUSES_CONSUMED] } },
      }),

      prisma.lot.count({
        where: {
          status: { in: [...STATUSES_PHYSICALLY_PRESENT] },
          updatedAt: { lt: daysAgo(STALE_DAYS) },
        },
      }),

      this.countMaterialsBelowReorder(),

      prisma.movement.count({ where: { createdAt: { gte: startOfToday() } } }),

      // Un cálculo con faltante es material que hay que comprar YA.
      prisma.calculation
        .findMany({
          where: { requirements: { some: { shortage: { gt: 0 } } } },
          select: { id: true },
        })
        .then((rows) => rows.length),

      prisma.purchaseRequest.count({
        where: { status: { in: [...OPEN_PURCHASE_REQUEST_STATUSES] } },
      }),
    ]);

    return {
      lotesEnBodega,
      retazos,
      sinMover90Dias,
      materialesBajoReorden,
      movimientosHoy,
      calculosConFaltante,
      requisicionesAbiertas,
    };
  }

  /**
   * Materiales cuyas existencias cayeron bajo su punto de reorden.
   *
   * Se resuelve en dos consultas y se compara en memoria porque Prisma no
   * sabe comparar una columna de `lots` contra una de `materials` dentro del
   * mismo `where`. Son catálogos de cientos de filas, no de millones: el
   * costo es despreciable frente a meter SQL crudo aquí.
   */
  private async countMaterialsBelowReorder(): Promise<number> {
    const [materials, stockByMaterial] = await Promise.all([
      prisma.material.findMany({
        where: { active: true, deletedAt: null, reorderPoint: { gt: 0 } },
        select: { id: true, reorderPoint: true },
      }),
      prisma.lot.groupBy({
        by: ["materialId"],
        where: { status: { in: [...STATUSES_PHYSICALLY_PRESENT] } },
        _sum: { currentQuantity: true },
      }),
    ]);

    const stock = new Map(
      stockByMaterial.map((row) => [
        row.materialId,
        Number(row._sum.currentQuantity ?? 0),
      ]),
    );

    return materials.filter(
      (material) =>
        (stock.get(material.id) ?? 0) < Number(material.reorderPoint),
    ).length;
  }

  /**
   * Existencias por dueño.
   *
   * La tela es del cliente que manda a maquilar, así que esta separación no
   * es un reporte más: es la que evita surtir material de Ternium a la
   * producción de otro.
   */
  async getStockByClient(): Promise<StockByClient[]> {
    const grouped = await prisma.lot.groupBy({
      by: ["clientId"],
      where: { status: { in: [...STATUSES_PHYSICALLY_PRESENT] } },
      _sum: { currentQuantity: true },
      _count: { _all: true },
    });

    const clientIds = grouped
      .map((row) => row.clientId)
      .filter((id): id is string => id !== null);

    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    });

    const names = new Map(clients.map((client) => [client.id, client.name]));

    return grouped
      .map((row) => ({
        clientId: row.clientId,
        // Un lote sin cliente es material propio de la fábrica.
        clientName: row.clientId
          ? (names.get(row.clientId) ?? "Cliente desconocido")
          : "Sin asignar",
        lots: row._count._all,
        quantity: Number(row._sum.currentQuantity ?? 0),
      }))
      .sort((a, b) => b.quantity - a.quantity);
  }

  async getRecentMovements(limit = 8): Promise<RecentMovement[]> {
    const movements = await prisma.movement.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        type: true,
        quantity: true,
        unit: true,
        createdAt: true,
        userName: true,
        lot: { select: { code: true } },
        material: { select: { name: true } },
      },
    });

    return movements.map((movement) => ({
      id: movement.id,
      code: movement.code,
      type: movement.type,
      quantity: Number(movement.quantity),
      unit: movement.unit,
      createdAt: movement.createdAt,
      lotCode: movement.lot.code,
      materialName: movement.material.name,
      userName: movement.userName,
    }));
  }
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
