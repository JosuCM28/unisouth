/**
 * El PO CLIENTE de la orden, armado con los de sus tallas.
 *
 * Cada talla lleva el PO al que pertenece (varias tallas comparten uno) y la
 * orden enseña la lista sin repetidos, en el orden en que aparecen. Así el
 * encabezado y las tallas nunca se contradicen, y el día del packing list
 * cada talla ya sabe de qué PO es.
 *
 * Se acepta que una talla traiga varios separados por coma —así se venían
 * capturando en la orden— y se parten para no repetirlos al juntar.
 *
 * Devuelve undefined si ninguna talla tiene PO: en ese caso el de la orden
 * se sigue capturando a mano, y no se debe pisar con un vacío.
 *
 * Es una función pura y vive aquí porque la usan dos lados: el formulario,
 * para enseñarlo mientras se captura, y el servicio, que es quien manda.
 */
export function mergeClientPos(
  values: (string | null | undefined)[],
): string | undefined {
  const seen = new Set<string>();

  for (const value of values) {
    for (const part of (value ?? "").split(",")) {
      const po = part.trim().toUpperCase();
      if (po) seen.add(po);
    }
  }

  if (seen.size === 0) return undefined;
  return [...seen].join(", ");
}

/** Una parte de la talla tal como se guarda: PO (o ninguno) y piezas. */
export interface LinePoSplit {
  clientPo: string | undefined;
  quantity: number;
}

/**
 * Las partes de una talla, siempre al menos una.
 *
 * Si la captura no trae desglose, la talla entera es UNA parte con su PO de
 * siempre. Así toda talla guardada tiene desglose y el packing list nunca
 * tiene que preguntar "¿y ésta de dónde saco la cantidad?".
 */
export function lineSplits(line: {
  orderedQuantity: number;
  clientPo?: string;
  poSplits: { clientPo?: string; quantity: number }[];
}): LinePoSplit[] {
  if (line.poSplits.length === 0) {
    return [{ clientPo: line.clientPo, quantity: line.orderedQuantity }];
  }
  return line.poSplits.map((split) => ({
    clientPo: split.clientPo,
    quantity: split.quantity,
  }));
}
