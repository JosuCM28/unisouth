/**
 * Ruta de la ficha de un material a partir de su clave.
 *
 * Existe porque la clave admite "/" (TELA/AZUL): metida cruda en un `href`
 * se leería como dos tramos distintos, y codificada de golpe con
 * `encodeURIComponent` se volvería "%2F", que algunos proxies y lectores de
 * QR devuelven ya decodificado. Se codifica tramo por tramo, que es lo que
 * entiende la ruta catch-all `/materials/[...code]`.
 */
export function materialPath(code: string): string {
  const path = code.split("/").map(encodeURIComponent).join("/");
  return `/materials/${path}`;
}
