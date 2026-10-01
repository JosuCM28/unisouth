/**
 * Reparto de bultos entre dos talleres (p. ej. 40% a uno y 60% a otro).
 *
 * El reparto se hace con los BULTOS tal como se capturaron en el corte: partir
 * un bulto obliga a abrirlo, recontarlo y volver a amarrarlo, y eso es justo lo
 * que el auxiliar quiere evitar. Por eso el resultado no es exacto: es la
 * combinación de bultos enteros que más se acerca al porcentaje.
 *
 * Es una función pura y no se guarda: el reparto es una ayuda para decidir qué
 * se carga en cada salida, y guardarlo lo dejaría contradiciendo al corte en
 * cuanto alguien corrija un bulto.
 */

/** Un renglón del corte: `count` bultos de `pieces` piezas de una talla. */
export interface SplitBundle {
  sizeCode: string;
  /** Piezas POR BULTO. */
  pieces: number;
  count: number;
  /**
   * Lo que el bulto trae de su captura, para poder armar el envío a taller
   * sin volver a la base: la talla por id, la orden de la que salió, su foleo
   * y la anotación de su renglón. Opcionales porque el reparto en sí sólo
   * necesita talla y piezas.
   */
  sizeId?: string;
  orderId?: string;
  orderCode?: string;
  tagId?: string | null;
  note?: string | null;
  /**
   * Un bulto de corte global puede ser de VARIAS órdenes: el reparto partió
   * sus piezas para completar a cada una. El bulto viaja entero al taller,
   * pero el envío nace por orden, así que aquí va qué parte es de cuál.
   */
  parts?: SplitBundlePart[];
}

/** La parte de un bulto físico que le toca a una orden. */
export interface SplitBundlePart {
  orderId: string;
  orderCode: string;
  sizeId: string;
  pieces: number;
  note: string | null;
}

/** Cuántos bultos de cierto tamaño le tocan a un lado. */
export interface SplitGroup {
  pieces: number;
  count: number;
}

export interface SplitSize {
  sizeCode: string;
  /** Total de la talla en el corte, de los dos lados. */
  total: number;
  /** Lo que le toca al lado del porcentaje y al resto, bultos agrupados. */
  first: SplitGroup[];
  second: SplitGroup[];
  /** Los mismos bultos de cada lado, con lo que traen de su captura. */
  firstBundles: SplitBundle[];
  secondBundles: SplitBundle[];
  firstPieces: number;
  secondPieces: number;
}

export interface SplitResult {
  sizes: SplitSize[];
  total: number;
  firstPieces: number;
  secondPieces: number;
  /** Lo que le tocaría al primer lado si se pudiera partir un bulto. */
  firstTarget: number;
  /** Piezas de más (+) o de menos (−) del primer lado contra su objetivo. */
  deviation: number;
}

/**
 * Topes de las tablas de programación dinámica. Con bultos de decenas de
 * piezas nunca se acercan; existen para que un corte absurdo no congele el
 * navegador, y por encima de ellos se cae a un reparto aproximado.
 */
const MAX_DP_CELLS = 4_000_000;
const MAX_COMBINE_STEPS = 40_000_000;

/**
 * Reparte los bultos: `firstPercent` % al primer lado, el resto al segundo.
 *
 * Dos criterios, en este orden:
 *
 * 1. **El total lo más cerca posible del porcentaje.** Es lo que se pidió y lo
 *    que se revisa al cargar el camión. Se buscan TODAS las combinaciones de
 *    bultos enteros y no se decide talla por talla: con un bulto por talla
 *    —76, 129, 122 y 32— decidir talla por talla mandaba 205 al lado del 40%
 *    cuando 122 + 32 = 154 quedaba a 10 piezas.
 * 2. **Parejo entre tallas.** Entre combinaciones igual de cercanas gana la
 *    que da a cada taller, de cada talla, lo más parecido a su porcentaje, y
 *    luego la que mueve menos bultos.
 */
export function splitBundles(
  bundles: SplitBundle[],
  firstPercent: number,
): SplitResult {
  const ratio = Math.min(Math.max(firstPercent, 0), 100) / 100;
  const groups = [...groupBySize(bundles)].map(([sizeCode, units]) => ({
    sizeCode,
    units,
    table: subsetTable(units.map((unit) => unit.pieces)),
  }));
  const tables = groups.map((group) => group.table);

  const grandTotal = tables.reduce((sum, table) => sum + table.total, 0);
  const sums =
    chooseSums(tables, ratio, grandTotal) ?? carrySums(tables, ratio);

  const sizes = groups.map((group, index): SplitSize => {
    const chosen = new Set(group.table.reconstruct(sums[index] ?? 0));
    const firstUnits = group.units.filter((_, i) => chosen.has(i));
    const secondUnits = group.units.filter((_, i) => !chosen.has(i));
    const firstPieces = firstUnits.reduce((sum, unit) => sum + unit.pieces, 0);

    return {
      sizeCode: group.sizeCode,
      total: group.table.total,
      first: collapse(firstUnits.map((unit) => unit.pieces)),
      second: collapse(secondUnits.map((unit) => unit.pieces)),
      firstBundles: toBundles(firstUnits),
      secondBundles: toBundles(secondUnits),
      firstPieces,
      secondPieces: group.table.total - firstPieces,
    };
  });

  const firstPieces = sizes.reduce((sum, size) => sum + size.firstPieces, 0);
  const firstTarget = Math.round(grandTotal * ratio);

  return {
    sizes,
    total: grandTotal,
    firstPieces,
    secondPieces: grandTotal - firstPieces,
    firstTarget,
    deviation: firstPieces - firstTarget,
  };
}

/** Las sumas que pueden dar los bultos de una talla. */
interface SubsetTable {
  total: number;
  /** Cada suma alcanzable y con cuántos bultos, como mínimo. */
  options: { sum: number; bundles: number }[];
  /** Los índices de los bultos que dan esa suma. */
  reconstruct: (sum: number) => number[];
}

/** Lo mejor encontrado para que el primer lado sume cierto total. */
interface Reach {
  /** Desbalance entre tallas: Σ |lo de la talla − su porcentaje|. */
  cost: Float64Array;
  /** Bultos movidos al primer lado. */
  moved: Float64Array;
}

/**
 * Cuánto de cada talla va al primer lado, buscando entre todas las
 * combinaciones (programación dinámica sobre el total del primer lado).
 *
 * Devuelve null si el problema es demasiado grande para el navegador.
 */
function chooseSums(
  tables: SubsetTable[],
  ratio: number,
  grandTotal: number,
): number[] | null {
  const steps = tables.reduce(
    (acc, table) => acc + table.options.length * (grandTotal + 1),
    0,
  );
  if (steps > MAX_COMBINE_STEPS) return null;

  let reach: Reach = {
    cost: new Float64Array(grandTotal + 1).fill(Infinity),
    moved: new Float64Array(grandTotal + 1).fill(Infinity),
  };
  reach.cost[0] = 0;
  reach.moved[0] = 0;

  // picks[k][s]: cuánto puso la talla k para llegar a s.
  const picks: Int32Array[] = [];
  for (const table of tables) {
    const step = addSize(reach, table, ratio, grandTotal);
    reach = step.reach;
    picks.push(step.pick);
  }

  const winner = closestTotal(reach, grandTotal * ratio);

  // Se recorre de la última talla a la primera, descontando lo que puso cada una.
  const sums = new Array<number>(tables.length).fill(0);
  let rest = winner;
  for (let k = tables.length - 1; k >= 0; k--) {
    const sum = Math.max(picks[k]![rest]!, 0);
    sums[k] = sum;
    rest -= sum;
  }

  return sums;
}

/** Agrega una talla a la tabla de totales alcanzables. */
function addSize(
  reach: Reach,
  table: SubsetTable,
  ratio: number,
  grandTotal: number,
): { reach: Reach; pick: Int32Array } {
  const exact = table.total * ratio;
  const next: Reach = {
    cost: new Float64Array(grandTotal + 1).fill(Infinity),
    moved: new Float64Array(grandTotal + 1).fill(Infinity),
  };
  const pick = new Int32Array(grandTotal + 1).fill(-1);

  for (let s = 0; s <= grandTotal; s++) {
    if (reach.cost[s] === Infinity) continue;

    for (const option of table.options) {
      const to = s + option.sum;
      const cost = reach.cost[s]! + Math.abs(option.sum - exact);
      const moved = reach.moved[s]! + option.bundles;

      if (isBetter(cost, moved, next.cost[to]!, next.moved[to]!)) {
        next.cost[to] = cost;
        next.moved[to] = moved;
        pick[to] = option.sum;
      }
    }
  }

  return { reach: next, pick };
}

/**
 * El total alcanzable más cercano al objetivo. A igual distancia, el más
 * parejo entre tallas y luego el que mueve menos bultos.
 */
function closestTotal(reach: Reach, target: number): number {
  let winner = -1;

  for (let s = 0; s < reach.cost.length; s++) {
    if (reach.cost[s] === Infinity) continue;
    if (winner < 0) {
      winner = s;
      continue;
    }

    const gap = Math.abs(s - target);
    const winnerGap = Math.abs(winner - target);
    if (gap < winnerGap) {
      winner = s;
    } else if (
      gap === winnerGap &&
      isBetter(reach.cost[s]!, reach.moved[s]!, reach.cost[winner]!, reach.moved[winner]!)
    ) {
      winner = s;
    }
  }

  return Math.max(winner, 0);
}

function isBetter(cost: number, moved: number, bestCost: number, bestMoved: number) {
  return cost < bestCost || (cost === bestCost && moved < bestMoved);
}

/**
 * Respaldo para cortes enormes: talla por talla, arrastrando el error a la
 * siguiente. Es aproximado, pero nunca deja la pantalla congelada.
 */
function carrySums(tables: SubsetTable[], ratio: number): number[] {
  let carry = 0;

  return tables.map((table) => {
    const exact = table.total * ratio;
    const target = exact - carry;
    let best = 0;
    for (const option of table.options) {
      if (Math.abs(option.sum - target) < Math.abs(best - target)) {
        best = option.sum;
      }
    }
    carry += best - exact;
    return best;
  });
}

/** Un bulto físico y el renglón capturado del que viene. */
interface Unit {
  pieces: number;
  source: SplitBundle;
}

/** Vuelve a juntar los bultos físicos en renglones, sin perder su origen. */
function toBundles(units: Unit[]): SplitBundle[] {
  const counts = new Map<SplitBundle, number>();
  for (const unit of units) {
    counts.set(unit.source, (counts.get(unit.source) ?? 0) + 1);
  }

  return [...counts.entries()].map(([source, count]) => ({ ...source, count }));
}

/** Un bulto físico por entrada, agrupados por talla. */
function groupBySize(bundles: SplitBundle[]): Map<string, Unit[]> {
  const map = new Map<string, Unit[]>();

  for (const bundle of bundles) {
    // Un bulto en cero o negativo es un ajuste de conteo, no algo que se cargue.
    if (bundle.pieces <= 0 || bundle.count <= 0) continue;

    const units = map.get(bundle.sizeCode) ?? [];
    for (let i = 0; i < bundle.count; i++) {
      units.push({ pieces: bundle.pieces, source: bundle });
    }
    map.set(bundle.sizeCode, units);
  }

  return new Map(
    [...map.entries()].sort(([a], [b]) =>
      a.localeCompare(b, "es", { numeric: true }),
    ),
  );
}

/** Junta los bultos iguales: [60, 60, 50] → 2 de 60 y 1 de 50. */
function collapse(units: number[]): SplitGroup[] {
  const counts = new Map<number, number>();
  for (const pieces of units) counts.set(pieces, (counts.get(pieces) ?? 0) + 1);

  return [...counts.entries()]
    .map(([pieces, count]) => ({ pieces, count }))
    .sort((a, b) => b.pieces - a.pieces);
}

/**
 * Todas las sumas que pueden dar los bultos de una talla, con el mínimo de
 * bultos para cada una, y cómo volver a los bultos de una suma.
 */
function subsetTable(units: number[]): SubsetTable {
  const total = units.reduce((sum, pieces) => sum + pieces, 0);

  if (units.length * (total + 1) > MAX_DP_CELLS) return greedyTable(units, total);

  // best[s] = menos bultos para sumar exactamente s (Infinity si no se puede).
  const best = new Array<number>(total + 1).fill(Infinity);
  best[0] = 0;
  // took[i][s]: el bulto i fue el que mejoró best[s] en su pasada.
  const took = units.map(() => new Uint8Array(total + 1));

  units.forEach((pieces, i) => {
    const row = took[i]!;
    for (let s = total; s >= pieces; s--) {
      const candidate = best[s - pieces]! + 1;
      if (candidate < best[s]!) {
        best[s] = candidate;
        row[s] = 1;
      }
    }
  });

  const options: SubsetTable["options"] = [];
  best.forEach((bundles, sum) => {
    if (bundles !== Infinity) options.push({ sum, bundles });
  });

  // Se reconstruye hacia atrás: el último bulto que tocó la celda es el suyo.
  function reconstruct(sum: number): number[] {
    const chosen: number[] = [];
    let s = sum;
    for (let i = units.length - 1; i >= 0 && s > 0; i--) {
      if (took[i]![s]) {
        chosen.push(i);
        s -= units[i]!;
      }
    }
    return chosen;
  }

  return { total, options, reconstruct };
}

/** Respaldo: sólo las sumas de ir tomando los bultos de mayor a menor. */
function greedyTable(units: number[], total: number): SubsetTable {
  const order = units
    .map((pieces, i) => ({ pieces, i }))
    .sort((a, b) => b.pieces - a.pieces);

  const options = [{ sum: 0, bundles: 0 }];
  let acc = 0;
  order.forEach(({ pieces }, k) => {
    acc += pieces;
    options.push({ sum: acc, bundles: k + 1 });
  });

  function reconstruct(sum: number): number[] {
    const chosen: number[] = [];
    let taken = 0;
    for (const { pieces, i } of order) {
      if (taken >= sum) break;
      chosen.push(i);
      taken += pieces;
    }
    return chosen;
  }

  return { total, options, reconstruct };
}
