/**
 * Qué día cuenta cada bulto cuando se vuelve a guardar un corte.
 *
 * Guardar un corte borra y recrea sus renglones, y la pantalla no dice qué
 * renglón es cuál: sólo manda cómo quedó. Así que aquí se compara lo que había
 * con lo que llega, talla por talla, para distinguir una CORRECCIÓN —que deja
 * cada bulto en el día en que se capturó— de un BULTO NUEVO, que cuenta hoy.
 *
 * Función pura a propósito: es la regla que decide en qué día cae cada pieza
 * de los reportes, y tiene que poder probarse sin base de datos.
 */

export interface PreviousCapture {
  lineId: string;
  quantity: number;
  bundles: number;
  /** Vacío = el día del corte. */
  capturedAt: Date | null;
}

export interface IncomingCapture {
  lineId: string;
  quantity: number;
  bundles: number;
}

type Dated<T> = T & { capturedAt: Date | null };

interface PoolRow {
  source: PreviousCapture;
  remaining: number;
  touched: boolean;
}

interface Slice {
  bundles: number;
  capturedAt: Date | null;
}

/**
 * La fecha de lo que se captura ahora.
 *
 * Un negativo no es corte de hoy: corrige un sobreconteo de antes. Fechado hoy
 * restaría piezas de un día en el que no se quitó nada de la mesa, así que se
 * queda en el día del corte.
 */
export function freshCaptureDate(quantity: number, now: Date): Date | null {
  return quantity < 0 ? null : now;
}

/** El día en que cuenta un bulto: el suyo y, si no tiene, el de su corte. */
export function effectiveCaptureDate(
  capturedAt: Date | null,
  openedAt: Date,
): Date {
  return capturedAt ?? openedAt;
}

export function assignCaptureDates<T extends IncomingCapture>(
  previous: PreviousCapture[],
  incoming: T[],
  now: Date,
): Array<Dated<T>> {
  const pool: PoolRow[] = previous.map((source) => ({
    source,
    remaining: source.bundles,
    touched: false,
  }));
  const slices = new Map<number, Slice[]>();
  const pending = new Set(incoming.keys());

  /* El orden importa: primero lo idéntico, para que un renglón parecido no se
     lleve la fecha de otro que sigue tal cual. */
  matchIdentical(pool, incoming, pending, slices);
  matchSameQuantity(pool, incoming, pending, slices, now);
  matchCorrections(pool, incoming, pending, slices);

  for (const index of pending) {
    const row = incoming[index] as T;
    slices.set(index, [
      { bundles: row.bundles, capturedAt: freshCaptureDate(row.quantity, now) },
    ]);
  }

  return incoming.flatMap((row, index) =>
    mergeSlices(slices.get(index) ?? []).map((slice) => ({
      ...row,
      bundles: slice.bundles,
      capturedAt: slice.capturedAt,
    })),
  );
}

/** Sigue igual: conserva su día. El color no entra: cambiarlo no es cortar. */
function matchIdentical<T extends IncomingCapture>(
  pool: PoolRow[],
  incoming: T[],
  pending: Set<number>,
  slices: Map<number, Slice[]>,
): void {
  for (const index of pending) {
    const row = incoming[index] as T;
    const match = pool.find(
      (old) =>
        !old.touched &&
        old.source.lineId === row.lineId &&
        old.source.quantity === row.quantity &&
        old.remaining === row.bundles,
    );
    if (!match) continue;

    match.touched = true;
    match.remaining = 0;
    slices.set(index, [
      { bundles: row.bundles, capturedAt: match.source.capturedAt },
    ]);
    pending.delete(index);
  }
}

/**
 * Misma cuenta por bulto, distinto número de bultos.
 *
 * Los bultos que ya estaban conservan su día y SÓLO los de más cuentan hoy, por
 * eso un 60 × 3 que pasa a 60 × 4 queda como dos renglones. Con uno solo habría
 * que elegir una fecha para los cuatro, y cualquiera mentiría sobre tres o
 * sobre uno.
 */
function matchSameQuantity<T extends IncomingCapture>(
  pool: PoolRow[],
  incoming: T[],
  pending: Set<number>,
  slices: Map<number, Slice[]>,
  now: Date,
): void {
  for (const index of pending) {
    const row = incoming[index] as T;
    const olds = pool.filter(
      (old) =>
        old.remaining > 0 &&
        old.source.lineId === row.lineId &&
        old.source.quantity === row.quantity,
    );
    if (olds.length === 0) continue;

    const taken = takeBundles(olds, row.bundles);
    const missing = row.bundles - taken.reduce((sum, s) => sum + s.bundles, 0);

    slices.set(
      index,
      missing > 0
        ? [
            ...taken,
            {
              bundles: missing,
              capturedAt: freshCaptureDate(row.quantity, now),
            },
          ]
        : taken,
    );
    pending.delete(index);
  }
}

function takeBundles(olds: PoolRow[], wanted: number): Slice[] {
  const taken: Slice[] = [];
  let left = wanted;

  for (const old of olds) {
    if (left === 0) break;

    const bundles = Math.min(left, old.remaining);
    old.remaining -= bundles;
    old.touched = true;
    left -= bundles;
    taken.push({ bundles, capturedAt: old.source.capturedAt });
  }

  return taken;
}

/**
 * En la misma talla cambió la cuenta: se toma como corrección del renglón que
 * desapareció, y se queda en su día. Es lo que pasa al cambiar 60 por 50.
 */
function matchCorrections<T extends IncomingCapture>(
  pool: PoolRow[],
  incoming: T[],
  pending: Set<number>,
  slices: Map<number, Slice[]>,
): void {
  for (const index of pending) {
    const row = incoming[index] as T;
    const match = pool.find(
      (old) => !old.touched && old.source.lineId === row.lineId,
    );
    if (!match) continue;

    match.touched = true;
    match.remaining = 0;
    slices.set(index, [
      { bundles: row.bundles, capturedAt: match.source.capturedAt },
    ]);
    pending.delete(index);
  }
}

/** Rebanadas del mismo día son un solo renglón: partirlo no diría nada. */
function mergeSlices(slices: Slice[]): Slice[] {
  const merged = new Map<number | null, Slice>();

  for (const slice of slices) {
    const key = slice.capturedAt?.getTime() ?? null;
    const current = merged.get(key);

    if (current) current.bundles += slice.bundles;
    else merged.set(key, { ...slice });
  }

  return [...merged.values()];
}
