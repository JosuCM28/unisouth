import type { MovementDirection, Unit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zonedDayKey } from "@/lib/history-range";

/**
 * Qué movió el material en la ventana consultada, por dirección.
 *
 * Lleva rollos Y metros porque son dos preguntas distintas que se hacen
 * juntas: "entraron 50 rollos con 7,000 metros". Sólo con los metros no se
 * sabe si llegó una pila o una pieza suelta; sólo con los rollos no se sabe
 * cuánta tela hay que acomodar.
 */
export interface DirectionKpi {
  direction: MovementDirection;
  /** Metros (o la unidad base) que se movieron. Siempre en positivo. */
  quantity: number;
  /** Rollos DISTINTOS tocados. Dos cortes al mismo rollo cuentan uno. */
  lots: number;
  /** Asientos del kárdex. Puede ser mayor que `lots`. */
  movements: number;
}

export interface MaterialHistoryKpis {
  inbound: DirectionKpi;
  outbound: DirectionKpi;
  /** Entradas − salidas: cuánto creció o se encogió la pila en la ventana. */
  net: number;
  unit: Unit;
}

const EMPTY_KPI = (direction: MovementDirection): DirectionKpi => ({
  direction,
  quantity: 0,
  lots: 0,
  movements: 0,
});

/**
 * KPIs del periodo: cuánto entró y cuánto salió de este material.
 *
 * Se calcula sobre TODA la ventana, no sobre la página que se está viendo:
 * si se sumaran las filas visibles, el encabezado diría un número distinto
 * cada vez que el auxiliar avanza de página, y dejaría de servir para cuadrar
 * contra lo que hay en el piso.
 *
 * Los traspasos (NEUTRAL) se excluyen a propósito: mueven el rollo de fila
 * con cantidad 0 y contarlos como entrada inflaría el total con tela que
 * nunca llegó de fuera.
 */
export async function getMaterialKpis(params: {
  materialId: string;
  unit: Unit;
  from?: Date;
  to?: Date;
}): Promise<MaterialHistoryKpis> {
  const where = buildWhere(params);

  /* Dos consultas y no una: `groupBy` sabe sumar y contar asientos, pero no
     sabe contar rollos DISTINTOS. El conteo de rollos únicos necesita su
     propio `groupBy` por [direction, lotId]. */
  const [sums, byLot] = await Promise.all([
    prisma.movement.groupBy({
      by: ["direction"],
      where,
      _sum: { quantity: true },
      _count: { _all: true },
    }),
    prisma.movement.groupBy({
      by: ["direction", "lotId"],
      where,
    }),
  ]);

  const lotsByDirection = new Map<MovementDirection, number>();
  for (const row of byLot) {
    lotsByDirection.set(
      row.direction,
      (lotsByDirection.get(row.direction) ?? 0) + 1,
    );
  }

  const inbound = EMPTY_KPI("IN");
  const outbound = EMPTY_KPI("OUT");

  for (const row of sums) {
    const target = row.direction === "IN" ? inbound : outbound;
    if (row.direction !== "IN" && row.direction !== "OUT") continue;

    // Las salidas se guardan en negativo: al usuario se le muestra la
    // magnitud, y el signo lo comunica el color y la flecha.
    target.quantity = Math.abs(Number(row._sum.quantity ?? 0));
    target.movements = row._count._all;
    target.lots = lotsByDirection.get(row.direction) ?? 0;
  }

  return {
    inbound,
    outbound,
    net: inbound.quantity - outbound.quantity,
    unit: params.unit,
  };
}

function buildWhere(params: { materialId: string; from?: Date; to?: Date }) {
  return {
    materialId: params.materialId,
    // Un traspaso no es ni entrada ni salida de la bodega.
    direction: { in: ["IN", "OUT"] as MovementDirection[] },
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from ? { gte: params.from } : {}),
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
  };
}


/** Lo que se movió en un día concreto. */
export interface MaterialDayRow {
  /** "2026-08-19", en la zona de la planta. */
  day: string;
  inQuantity: number;
  inLots: number;
  outQuantity: number;
  outLots: number;
}

/**
 * Cuántos días se desglosan como máximo.
 *
 * Con el rango en "Año" serían 365 renglones, que ya no es un reporte sino un
 * volcado. Se cortan los más viejos y se avisa: los días recientes son los
 * que se vienen a cuadrar.
 */
const MAX_DAYS = 62;

export interface MaterialDailyReport {
  rows: MaterialDayRow[];
  unit: Unit;
  /** Hubo más días con movimiento de los que se listan. */
  truncated: boolean;
}

/**
 * Desglose día por día de lo que entró y salió del material.
 *
 * Responde la pregunta de la recepción masiva: "hoy metí 50 rollos de esta
 * tela, ¿cuántos metros fueron?". Los KPIs dan el total de la ventana; esto
 * dice en qué día cayó cada cosa, que es lo que se coteja contra las guías
 * del proveedor.
 *
 * Se agrupa en memoria y no con un `groupBy` de SQL por fecha porque el día
 * hay que calcularlo EN LA ZONA DE LA PLANTA: Postgres agruparía por fecha
 * UTC y una recepción de las 19:00 aparecería al día siguiente.
 */
export async function getMaterialDailyReport(params: {
  materialId: string;
  unit: Unit;
  from?: Date;
  to?: Date;
}): Promise<MaterialDailyReport> {
  const movements = await prisma.movement.findMany({
    where: buildWhere(params),
    select: {
      createdAt: true,
      direction: true,
      quantity: true,
      lotId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  /* Los rollos se cuentan DISTINTOS por día: dos cortes al mismo rollo en la
     misma jornada son un rollo tocado, no dos. */
  const byDay = new Map<
    string,
    { row: MaterialDayRow; inLots: Set<string>; outLots: Set<string> }
  >();

  for (const movement of movements) {
    const day = zonedDayKey(movement.createdAt);

    const entry =
      byDay.get(day) ??
      {
        row: { day, inQuantity: 0, inLots: 0, outQuantity: 0, outLots: 0 },
        inLots: new Set<string>(),
        outLots: new Set<string>(),
      };

    const quantity = Math.abs(Number(movement.quantity));

    if (movement.direction === "IN") {
      entry.row.inQuantity += quantity;
      entry.inLots.add(movement.lotId);
    } else {
      entry.row.outQuantity += quantity;
      entry.outLots.add(movement.lotId);
    }

    byDay.set(day, entry);
  }

  const all = [...byDay.values()].map((entry) => ({
    ...entry.row,
    inLots: entry.inLots.size,
    outLots: entry.outLots.size,
  }));

  // Del día más reciente al más viejo: lo de hoy es lo que se viene a cuadrar.
  all.sort((a, b) => b.day.localeCompare(a.day));

  return {
    rows: all.slice(0, MAX_DAYS),
    unit: params.unit,
    truncated: all.length > MAX_DAYS,
  };
}
