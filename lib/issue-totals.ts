import type { Unit } from "@prisma/client";

/** Cuánto se lleva el vale de una unidad concreta. */
export interface IssueUnitTotal {
  unit: Unit;
  /** Suma de las cantidades tecleadas, ya en número. */
  quantity: number;
  /** Renglones que aportaron a esta suma. */
  lines: number;
}

/** Un renglón visto por el sumador: sólo lo que necesita para sumar. */
interface SummableLine {
  unit: Unit;
  /** Texto, porque el input vive a medio teclear. */
  quantity: string;
  available: number;
}

export interface IssueTotals {
  /** Una entrada por unidad, en el orden en que apareció en el vale. */
  totals: IssueUnitTotal[];
  /** Renglones con cantidad > 0. Los vacíos no cuentan como rollo puesto. */
  lines: number;
  /** Renglones que piden más de lo que hay en el rollo. */
  exceeding: number;
}

/**
 * Suma lo que va saliendo, agrupado POR UNIDAD.
 *
 * Se agrupa en vez de dar un solo número porque un vale puede llevar tela en
 * metros y cierres en piezas, y sumar 40 m con 200 pzas daría "240" de nada.
 * En la salida típica —puros rollos de la misma tela— hay una sola unidad y
 * el resultado es justo el total de metros que se buscaba ver.
 *
 * Un renglón a medio teclear ("12.") o en blanco aporta cero y no rompe la
 * suma: el auxiliar ve el total moverse conforme escribe, no un "NaN".
 */
export function sumIssueLines(lines: SummableLine[]): IssueTotals {
  const byUnit = new Map<Unit, IssueUnitTotal>();
  let counted = 0;
  let exceeding = 0;

  for (const line of lines) {
    const quantity = Number(line.quantity);

    // Se descarta lo que no es un número utilizable en vez de propagar NaN,
    // que contaminaría el total entero por un solo renglón a medio escribir.
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    counted += 1;
    if (quantity > line.available) exceeding += 1;

    const current = byUnit.get(line.unit) ?? {
      unit: line.unit,
      quantity: 0,
      lines: 0,
    };

    current.quantity += quantity;
    current.lines += 1;
    byUnit.set(line.unit, current);
  }

  return { totals: [...byUnit.values()], lines: counted, exceeding };
}
