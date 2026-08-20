import type { MovementDirection, Unit } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
