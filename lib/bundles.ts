/**
 * La aritmética del bulto, en un solo lugar.
 *
 * En toda la app —tabla de corte del vale, captura de corte, envío a taller—
 * la cantidad de un renglón es POR BULTO: "3 bultos de 60" son 180 prendas,
 * no 60. Es como se llena la hoja de papel y como se amarra el bulto en la
 * mesa, y por eso el número que se teclea es el del bulto.
 *
 * Vive aparte porque el error de sumar sin multiplicar deja el total en una
 * fracción de lo que sale y no revienta nada: nadie se entera hasta el conteo.
 */

/** Un renglón visto por el sumador: sólo lo que necesita para multiplicar. */
export interface BundledRow {
  quantity: number;
  bundles: number;
}

/** Las prendas que vale un renglón. */
export function bundlePieces(row: BundledRow): number {
  return row.quantity * row.bundles;
}

/** Las prendas que valen varios renglones. */
export function sumBundlePieces(rows: BundledRow[]): number {
  return rows.reduce((total, row) => total + bundlePieces(row), 0);
}

/** Los bultos que suman varios renglones. */
export function sumBundles(rows: BundledRow[]): number {
  return rows.reduce((total, row) => total + row.bundles, 0);
}
