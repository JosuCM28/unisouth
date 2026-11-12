/**
 * El desglose por PO de una talla mientras se captura.
 *
 * Vive fuera del formulario porque lo arman también las páginas (servidor)
 * al abrir una orden para editarla o duplicarla, y una función exportada de
 * un archivo "use client" no se puede llamar desde el servidor.
 */

/** Una parte de la talla a medio teclear: todo es texto hasta guardar. */
export interface PoSplitDraft {
  key: string;
  clientPo: string;
  quantity: string;
}

export function emptySplit(): PoSplitDraft {
  return { key: crypto.randomUUID(), clientPo: "", quantity: "" };
}

/**
 * Las partes de una talla ya guardada.
 *
 * Una talla de antes de que existiera el desglose no trae partes: se abre
 * como una sola con su cantidad y su PO, que es exactamente lo que era.
 */
export function splitDraftsFromLine(line: {
  orderedQuantity: number;
  clientPo: string | null;
  poSplits: { clientPo: string | null; quantity: number }[];
}): PoSplitDraft[] {
  if (line.poSplits.length === 0) {
    return [
      {
        key: crypto.randomUUID(),
        clientPo: line.clientPo ?? "",
        quantity: String(line.orderedQuantity),
      },
    ];
  }

  return line.poSplits.map((split) => ({
    key: crypto.randomUUID(),
    clientPo: split.clientPo ?? "",
    quantity: String(split.quantity),
  }));
}

/** Las piezas de la talla: la suma de sus partes, vacías como cero. */
export function splitsTotal(splits: PoSplitDraft[]): number {
  return splits.reduce((sum, split) => sum + (Number(split.quantity) || 0), 0);
}
