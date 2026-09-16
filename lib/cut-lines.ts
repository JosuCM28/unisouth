import { sumBundlePieces } from "./bundles";
import type { DocumentCutLineInput } from "./validations/document.schema";

/**
 * Lo que un corte entrega, traducido a renglones de vale.
 *
 * Vive aparte de los servicios porque lo necesitan dos: la salida de UNA orden
 * y la salida global de un PEDIDO, que se lleva los cortes de varias órdenes
 * en un solo papel. Duplicar esta regla sería duplicar la parte más sutil del
 * módulo —la de las correcciones— y bastaría con arreglar un lado para que los
 * dos vales dejaran de decir lo mismo.
 *
 * Es una función pura: recibe lo ya leído de la base y no consulta nada. Así
 * la puede usar la pantalla para la vista previa y el servicio para crear el
 * vale, con la certeza de que las dos van a mostrar los mismos números.
 */

/** Una talla de la orden. El renglón contra el que se leen las capturas. */
export interface CutSourceLine {
  id: string;
  sizeId: string;
  tagId: string | null;
  notes: string | null;
}

/** Una captura de la mesa: piezas POR BULTO y cuántos bultos van así. */
export interface CutEntry {
  lineId: string;
  quantity: number;
  bundles: number;
}

/**
 * Un renglón listo para el vale.
 *
 * Es el tipo del esquema del documento y no uno propio, para que lo que sale
 * de aquí entre directo en `DocumentService.create` sin una traducción en
 * medio: esa traducción es donde se pierde un campo y nadie lo nota hasta que
 * el vale sale sin foleo.
 */
export type CutLineDraft = DocumentCutLineInput;

/**
 * Cruza las tallas de la orden con las capturas de UN corte.
 *
 * Se recorren las TALLAS y no las capturas para respetar el orden del pedido:
 * el vale se lee al lado de la orden, talla por talla y en su orden.
 *
 * Las tallas con neto cero o negativo se caen: un corte puede llevar una
 * corrección que descuenta piezas mal contadas, y mandar "-8 piezas" en un
 * vale no significa nada para el taller que lo firma.
 */
export function toCutLines(
  lines: CutSourceLine[],
  entries: CutEntry[],
): CutLineDraft[] {
  const byLine = new Map<string, CutEntry[]>();

  for (const entry of entries) {
    const rows = byLine.get(entry.lineId) ?? [];
    rows.push(entry);
    byLine.set(entry.lineId, rows);
  }

  return lines.flatMap((line) => {
    const rows = byLine.get(line.id) ?? [];
    const net = sumBundlePieces(rows);

    if (net <= 0) return [];

    const captured = rows.filter((row) => row.quantity > 0);

    /* Con una corrección de por medio el desglose deja de describir lo que se
       va a entregar —el bulto de 30 ya no lleva 30— y el vale se firma contra
       bultos de verdad. Entonces va el neto en un solo renglón y el auxiliar
       anota los bultos al empacar. Sin correcciones, que es el caso normal,
       cada bulto viaja como su propio renglón. */
    const cutRows =
      sumBundlePieces(captured) === net ? captured : [{ quantity: net, bundles: 1 }];

    return cutRows.map((row) => ({
      sizeId: line.sizeId,
      quantity: row.quantity,
      bundles: row.bundles,
      tagId: line.tagId ?? undefined,
      notes: line.notes ?? undefined,
    }));
  });
}
