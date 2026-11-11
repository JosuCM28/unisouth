/**
 * Reparto de un corte (o de un pedido) entre dos talleres, p. ej. 40% / 60%.
 *
 * La unidad es la ORDEN completa. Cada orden es una prenda distinta, y mientras
 * menos órdenes queden partidas entre los dos talleres menos se mezcla: cada
 * taller trabaja prendas enteras y el seguimiento por orden queda limpio. Por
 * eso se mandan órdenes completas a un lado y, si con eso no se llega al
 * porcentaje, se parte UNA sola orden para completar lo que falta.
 *
 * Esa orden se parte por TALLA completa: todos los bultos de su 32 van al mismo
 * taller, porque partir una talla obligaría a cada taller a recibir un pedazo
 * de la corrida. Por eso el resultado no es exacto: es la combinación más
 * cercana al porcentaje que respeta esas dos reglas.
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
   * sin volver a la base: la talla por id, la orden de la que salió, su folio
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
  /** Lo que le tocaría al primer lado si se pudiera partir una talla. */
  firstTarget: number;
  /** Piezas de más (+) o de menos (−) del primer lado contra su objetivo. */
  deviation: number;
}

/**
 * Hasta cuántas piezas se tolera que el reparto se aparte del porcentaje.
 *
 * También decide si vale la pena partir una orden: si con órdenes completas ya
 * se queda dentro de esto, no se parte ninguna. Partir una orden de 2000 para
 * ganar 5 piezas de precisión mezcla más de lo que ayuda.
 */
export const SPLIT_TOLERANCE_PIECES = 40;

/**
 * Tope de trabajo de las búsquedas. Con pedidos reales nunca se acerca; existe
 * para que uno absurdo no congele el navegador, y por encima de él se cae a un
 * reparto aproximado.
 */
const MAX_COMBINE_STEPS = 40_000_000;

/** Un bulto físico y el renglón capturado del que viene. */
interface Unit {
  pieces: number;
  source: SplitBundle;
}

/** Todos los bultos de una talla dentro de una orden: van juntos o no van. */
interface SizePile {
  sizeCode: string;
  units: Unit[];
  total: number;
}

/** Una orden con sus tallas. */
interface OrderPile {
  key: string;
  sizes: SizePile[];
  total: number;
}

/**
 * Reparte: `firstPercent` % al primer lado, el resto al segundo, con órdenes
 * completas y a lo más una orden partida por tallas.
 */
export function splitBundles(
  bundles: SplitBundle[],
  firstPercent: number,
): SplitResult {
  const ratio = Math.min(Math.max(firstPercent, 0), 100) / 100;
  const orders = groupByOrder(bundles);
  const grandTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const exact = grandTotal * ratio;

  const goesFirst = choosePiles(orders, exact);
  const sizes = buildSizes(orders, goesFirst);

  const firstPieces = sizes.reduce((sum, size) => sum + size.firstPieces, 0);
  const firstTarget = Math.round(exact);

  return {
    sizes,
    total: grandTotal,
    firstPieces,
    secondPieces: grandTotal - firstPieces,
    firstTarget,
    deviation: firstPieces - firstTarget,
  };
}

/** Un reparto candidato: qué tallas-de-orden van al primer lado y cuánto suman. */
interface Plan {
  first: Set<SizePile>;
  sum: number;
}

/**
 * Qué tallas-de-orden van al primer lado.
 *
 * Primero sólo órdenes completas. Si eso ya queda dentro de la tolerancia, se
 * acepta aunque partiendo una se acercara más. Si no, se prueba partir cada
 * orden —una a la vez— y gana la combinación más cercana al porcentaje.
 */
function choosePiles(orders: OrderPile[], exact: number): Set<SizePile> {
  if (!fitsBudget(orders)) return greedyPlan(orders, exact).first;

  const whole = wholeOrdersPlan(orders, exact);
  if (Math.abs(whole.sum - exact) <= SPLIT_TOLERANCE_PIECES) return whole.first;

  let best = whole;
  orders.forEach((_, index) => {
    const plan = splitOrderPlan(orders, index, exact);
    if (Math.abs(plan.sum - exact) < Math.abs(best.sum - exact)) best = plan;
  });

  return best.first;
}

/** Si las búsquedas caben en el tope de trabajo. */
function fitsBudget(orders: OrderPile[]): boolean {
  const grandTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const sizeCount = orders.reduce((sum, order) => sum + order.sizes.length, 0);
  const steps = orders.length * (orders.length + 1) * (grandTotal + 1) + sizeCount * (grandTotal + 1);
  return steps <= MAX_COMBINE_STEPS;
}

/** El mejor reparto sin partir ninguna orden. */
function wholeOrdersPlan(orders: OrderPile[], exact: number): Plan {
  const totals = orders.map((order) => order.total);
  const reach = reachSums(totals);
  const sum = closestReachable(reach.reachable, exact);
  const used = pickItems(reach, totals, sum);

  return {
    first: new Set(orders.filter((_, i) => used[i]).flatMap((order) => order.sizes)),
    sum,
  };
}

/**
 * El mejor reparto partiendo la orden `splitIndex`: las demás van completas a
 * un lado o al otro, y las tallas de ésta completan lo que falte.
 */
function splitOrderPlan(orders: OrderPile[], splitIndex: number, exact: number): Plan {
  const split = orders[splitIndex]!;
  const others = orders.filter((_, i) => i !== splitIndex);

  const otherTotals = others.map((order) => order.total);
  const wholeReach = reachSums(otherTotals);
  const sizeTotals = split.sizes.map((size) => size.total);
  const sizeReach = reachSums(sizeTotals);
  const nearest = nearestTable(sizeReach.reachable);

  let bestWhole = 0;
  let bestPart = 0;
  let bestGap = Infinity;
  for (let w = 0; w < wholeReach.reachable.length; w++) {
    if (!wholeReach.reachable[w]) continue;
    const part = nearest.closest(exact - w);
    const gap = Math.abs(w + part - exact);
    if (gap < bestGap) {
      bestGap = gap;
      bestWhole = w;
      bestPart = part;
    }
  }

  const usedOrders = pickItems(wholeReach, otherTotals, bestWhole);
  const usedSizes = pickItems(sizeReach, sizeTotals, bestPart);

  return {
    first: new Set([
      ...others.filter((_, i) => usedOrders[i]).flatMap((order) => order.sizes),
      ...split.sizes.filter((_, i) => usedSizes[i]),
    ]),
    sum: bestWhole + bestPart,
  };
}

/** Qué totales se alcanzan sumando algunos de los valores, y con cuál se llegó. */
interface Reach {
  reachable: Uint8Array;
  /** taken[i][s] = 1 si el total s se alcanzó por primera vez con el valor i. */
  taken: Uint8Array[];
}

/** Suma de subconjuntos (mochila 0/1): cada valor se usa entero o no se usa. */
function reachSums(values: number[]): Reach {
  const limit = values.reduce((sum, value) => sum + value, 0);
  const reachable = new Uint8Array(limit + 1);
  reachable[0] = 1;
  const taken: Uint8Array[] = [];

  for (const value of values) {
    const took = new Uint8Array(limit + 1);
    // De arriba hacia abajo para no usar el mismo valor dos veces.
    for (let s = limit - value; s >= 0; s--) {
      if (reachable[s] && !reachable[s + value]) {
        reachable[s + value] = 1;
        took[s + value] = 1;
      }
    }
    taken.push(took);
  }

  return { reachable, taken };
}

/** Qué valores forman el total `sum`, recorriendo del último al primero. */
function pickItems(reach: Reach, values: number[], sum: number): boolean[] {
  const used = new Array<boolean>(values.length).fill(false);
  let rest = sum;
  for (let i = values.length - 1; i >= 0; i--) {
    if (reach.taken[i]![rest]) {
      used[i] = true;
      rest -= values[i]!;
    }
  }
  return used;
}

/** El total alcanzable más cercano al objetivo; a igual distancia, el menor. */
function closestReachable(reachable: Uint8Array, target: number): number {
  let winner = 0;
  for (let s = 0; s < reachable.length; s++) {
    if (reachable[s] && Math.abs(s - target) < Math.abs(winner - target)) winner = s;
  }
  return winner;
}

/**
 * Para cualquier objetivo, el total alcanzable más cercano en tiempo constante.
 * Sin esto, probar cada combinación de órdenes completas contra cada
 * combinación de tallas sería cuadrático.
 */
function nearestTable(reachable: Uint8Array) {
  const top = reachable.length - 1;
  const below = new Int32Array(top + 1);
  const above = new Int32Array(top + 1);

  let last = 0;
  for (let v = 0; v <= top; v++) {
    if (reachable[v]) last = v;
    below[v] = last;
  }
  last = top;
  for (let v = top; v >= 0; v--) {
    if (reachable[v]) last = v;
    above[v] = last;
  }

  const clamp = (value: number) => Math.min(Math.max(value, 0), top);

  return {
    closest(target: number): number {
      const low = below[clamp(Math.floor(target))]!;
      const high = above[clamp(Math.ceil(target))]!;
      return Math.abs(low - target) <= Math.abs(high - target) ? low : high;
    },
  };
}

/**
 * Respaldo para pedidos enormes: órdenes completas de la más grande a la más
 * chica mientras quepan, y la primera que no quepa completa con sus tallas.
 * Es aproximado, pero nunca deja la pantalla congelada.
 */
function greedyPlan(orders: OrderPile[], exact: number): Plan {
  const first = new Set<SizePile>();
  let sum = 0;
  let splitDone = false;

  for (const order of [...orders].sort((a, b) => b.total - a.total)) {
    if (sum + order.total <= exact) {
      order.sizes.forEach((size) => first.add(size));
      sum += order.total;
      continue;
    }
    if (splitDone) continue;
    splitDone = true;
    for (const size of [...order.sizes].sort((a, b) => b.total - a.total)) {
      if (sum + size.total > exact) continue;
      first.add(size);
      sum += size.total;
    }
  }

  return { first, sum };
}

/**
 * La orden a la que se carga un renglón. Un bulto de corte global que es de
 * varias órdenes cuenta para la que más piezas tiene en él: el bulto viaja
 * entero y algún dueño tiene que llevarlo.
 */
function orderKeyOf(bundle: SplitBundle): string {
  if (bundle.parts && bundle.parts.length > 0) {
    const main = bundle.parts.reduce((best, part) => (part.pieces > best.pieces ? part : best));
    return main.orderCode;
  }
  return bundle.orderCode ?? bundle.orderId ?? "";
}

/** Un bulto físico por entrada, agrupados por orden y dentro por talla. */
function groupByOrder(bundles: SplitBundle[]): OrderPile[] {
  const byOrder = new Map<string, Map<string, Unit[]>>();

  for (const bundle of bundles) {
    // Un bulto en cero o negativo es un ajuste de conteo, no algo que se cargue.
    if (bundle.pieces <= 0 || bundle.count <= 0) continue;

    const key = orderKeyOf(bundle);
    const sizes = byOrder.get(key) ?? new Map<string, Unit[]>();
    const units = sizes.get(bundle.sizeCode) ?? [];
    for (let i = 0; i < bundle.count; i++) {
      units.push({ pieces: bundle.pieces, source: bundle });
    }
    sizes.set(bundle.sizeCode, units);
    byOrder.set(key, sizes);
  }

  return [...byOrder.entries()]
    .sort(([a], [b]) => compareCodes(a, b))
    .map(([key, sizes]) => {
      const piles = [...sizes.entries()]
        .sort(([a], [b]) => compareCodes(a, b))
        .map(([sizeCode, units]) => ({
          sizeCode,
          units,
          total: units.reduce((sum, unit) => sum + unit.pieces, 0),
        }));
      return { key, sizes: piles, total: piles.reduce((sum, pile) => sum + pile.total, 0) };
    });
}

/**
 * Los renglones por talla de la pantalla. Ahora una misma talla puede tener
 * piezas en los dos lados —la 34 de una orden a un taller y la de otra al
 * otro—, y el desglose por folio dice cuál es cuál.
 */
function buildSizes(orders: OrderPile[], goesFirst: Set<SizePile>): SplitSize[] {
  const bySize = new Map<string, { first: Unit[]; second: Unit[] }>();

  for (const pile of orders.flatMap((order) => order.sizes)) {
    const row = bySize.get(pile.sizeCode) ?? { first: [], second: [] };
    if (goesFirst.has(pile)) row.first.push(...pile.units);
    else row.second.push(...pile.units);
    bySize.set(pile.sizeCode, row);
  }

  return [...bySize.entries()]
    .sort(([a], [b]) => compareCodes(a, b))
    .map(([sizeCode, row]) => {
      const firstPieces = sumUnits(row.first);
      const secondPieces = sumUnits(row.second);
      return {
        sizeCode,
        total: firstPieces + secondPieces,
        first: collapse(row.first.map((unit) => unit.pieces)),
        second: collapse(row.second.map((unit) => unit.pieces)),
        firstBundles: toBundles(row.first),
        secondBundles: toBundles(row.second),
        firstPieces,
        secondPieces,
      };
    });
}

function sumUnits(units: Unit[]): number {
  return units.reduce((sum, unit) => sum + unit.pieces, 0);
}

function compareCodes(a: string, b: string): number {
  return a.localeCompare(b, "es", { numeric: true });
}

/** Vuelve a juntar los bultos físicos en renglones, sin perder su origen. */
function toBundles(units: Unit[]): SplitBundle[] {
  const counts = new Map<SplitBundle, number>();
  for (const unit of units) {
    counts.set(unit.source, (counts.get(unit.source) ?? 0) + 1);
  }

  return [...counts.entries()].map(([source, count]) => ({ ...source, count }));
}

/** Junta los bultos iguales: [60, 60, 50] → 2 de 60 y 1 de 50. */
function collapse(units: number[]): SplitGroup[] {
  const counts = new Map<number, number>();
  for (const pieces of units) counts.set(pieces, (counts.get(pieces) ?? 0) + 1);

  return [...counts.entries()]
    .map(([pieces, count]) => ({ pieces, count }))
    .sort((a, b) => b.pieces - a.pieces);
}
