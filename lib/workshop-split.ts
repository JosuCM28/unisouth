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
 * Tope de celdas de la tabla de programación dinámica. Con bultos de decenas
 * de piezas nunca se acerca; existe para que un corte absurdo no congele el
 * navegador, y por encima de él se cae a un reparto goloso.
 */
const MAX_DP_CELLS = 4_000_000;

/**
 * Reparte los bultos: `firstPercent` % al primer lado, el resto al segundo.
 *
 * Se resuelve talla por talla —cada taller debe recibir de todas las tallas en
 * la proporción pedida— y el error de cada talla se ARRASTRA a la siguiente.
 * Sin ese arrastre, cinco tallas con +10 piezas cada una sumarían +50 en el
 * total; con él el total se mantiene cerca del objetivo aunque ninguna talla
 * cuadre sola.
 */
export function splitBundles(
  bundles: SplitBundle[],
  firstPercent: number,
): SplitResult {
  const ratio = Math.min(Math.max(firstPercent, 0), 100) / 100;
  const bySize = groupBySize(bundles);

  let carry = 0;
  const sizes: SplitSize[] = [];

  for (const [sizeCode, units] of bySize) {
    const pieces = units.map((unit) => unit.pieces);
    const total = pieces.reduce((sum, value) => sum + value, 0);
    const exact = total * ratio;

    const chosen = pickSubset(pieces, exact - carry);
    const firstPieces = chosen.reduce((sum, i) => sum + (pieces[i] ?? 0), 0);
    carry += firstPieces - exact;

    const taken = new Set(chosen);
    const firstUnits = units.filter((_, i) => taken.has(i));
    const secondUnits = units.filter((_, i) => !taken.has(i));

    sizes.push({
      sizeCode,
      total,
      first: collapse(firstUnits.map((unit) => unit.pieces)),
      second: collapse(secondUnits.map((unit) => unit.pieces)),
      firstBundles: toBundles(firstUnits),
      secondBundles: toBundles(secondUnits),
      firstPieces,
      secondPieces: total - firstPieces,
    });
  }

  const total = sizes.reduce((sum, size) => sum + size.total, 0);
  const firstPieces = sizes.reduce((sum, size) => sum + size.firstPieces, 0);
  const firstTarget = Math.round(total * ratio);

  return {
    sizes,
    total,
    firstPieces,
    secondPieces: total - firstPieces,
    firstTarget,
    deviation: firstPieces - firstTarget,
  };
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
 * Los índices de los bultos cuya suma queda más cerca de `target`.
 *
 * A igualdad de cercanía gana la combinación con MENOS bultos: son menos
 * bultos que mover, y es lo que se pidió ("lo mínimo para que sea exacto").
 */
function pickSubset(units: number[], target: number): number[] {
  const sum = units.reduce((total, pieces) => total + pieces, 0);
  if (units.length === 0 || target <= 0) return [];
  if (target >= sum) return units.map((_, i) => i);

  if (units.length * (sum + 1) > MAX_DP_CELLS) return greedy(units, target);

  // best[s] = menos bultos para sumar exactamente s (Infinity si no se puede).
  const best = new Array<number>(sum + 1).fill(Infinity);
  best[0] = 0;
  // took[i][s]: el bulto i fue el que mejoró best[s] en su pasada.
  const took = units.map(() => new Uint8Array(sum + 1));

  units.forEach((pieces, i) => {
    const row = took[i]!;
    for (let s = sum; s >= pieces; s--) {
      const candidate = best[s - pieces]! + 1;
      if (candidate < best[s]!) {
        best[s] = candidate;
        row[s] = 1;
      }
    }
  });

  let winner = 0;
  for (let s = 0; s <= sum; s++) {
    if (best[s] === Infinity) continue;
    const gap = Math.abs(s - target);
    const winnerGap = Math.abs(winner - target);
    if (gap < winnerGap || (gap === winnerGap && best[s]! < best[winner]!)) {
      winner = s;
    }
  }

  // Se reconstruye hacia atrás: el último bulto que tocó la celda es el suyo.
  const chosen: number[] = [];
  let s = winner;
  for (let i = units.length - 1; i >= 0 && s > 0; i--) {
    if (took[i]![s]) {
      chosen.push(i);
      s -= units[i]!;
    }
  }

  return chosen;
}

/** Reparto de respaldo: los bultos grandes primero, mientras no se pase. */
function greedy(units: number[], target: number): number[] {
  const order = units
    .map((pieces, i) => ({ pieces, i }))
    .sort((a, b) => b.pieces - a.pieces);

  const chosen: number[] = [];
  let acc = 0;
  for (const { pieces, i } of order) {
    if (acc + pieces <= target) {
      chosen.push(i);
      acc += pieces;
    }
  }

  return chosen;
}
