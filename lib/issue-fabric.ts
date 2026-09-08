/**
 * Con qué tela se hizo la salida.
 *
 * Son TRES orígenes y no dos, en este orden:
 *
 *  1. Las telas de los rollos que salieron. Mandan sobre todo lo demás porque
 *     son lo que de verdad se descontó del almacén.
 *  2. La tela del catálogo capturada en el encabezado de corte, para los vales
 *     que no llevan rollos —al taller salen prendas ya cortadas—.
 *  3. La tela escrita a MANO, para el paño que todavía no existe como
 *     material.
 *
 * El tercer escalón es el que faltaba: la columna salía vacía en vales que SÍ
 * traen tela, sólo que capturada como texto porque el trabajo no espera al
 * alta del material. Es el mismo hueco que ya se había tapado en órdenes con
 * `orderFabric`.
 *
 * Vive en `lib/` y no junto a la tarjeta porque lo comparten un componente de
 * cliente, la página y la ruta del Excel; colgarlo de `issue-summary` habría
 * arrastrado Prisma al bundle del navegador.
 */
export interface IssueFabricSource {
  summary: { materialNames: string[] };
  /** Tela del catálogo, cuando está registrada. */
  cutFabricName: string | null;
  /** Tela apuntada a mano. Convive con la del catálogo; ésta cede. */
  cutFabricText: string | null;
}

export function issueFabric(issue: IssueFabricSource): string | null {
  if (issue.summary.materialNames.length > 0) {
    return issue.summary.materialNames.join(" · ");
  }

  /* Se recorta antes de decidir: un campo con puros espacios está vacío para
     el que lo lee, y sin esto pintaría un renglón en blanco en vez de caer al
     siguiente origen. */
  const catalogue = issue.cutFabricName?.trim();
  if (catalogue) return catalogue;

  const handwritten = issue.cutFabricText?.trim();
  return handwritten ? handwritten : null;
}
