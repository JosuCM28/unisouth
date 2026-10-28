import type { Prisma } from "@prisma/client";
import type { XlsxColumn } from "@/lib/export/xlsx";
import {
  dayMonthYear,
  groupLots,
  itemNumbersOf,
  shippingOf,
  type ReceiptForSummary,
} from "./receipt-summary";

/**
 * EL ÍNDICE GLOBAL DE NÚMEROS DE ÍTEM: qué tela y qué recepción le tocó a
 * cada número de la serie que sale en los correos de recepción.
 *
 * Existe para contestar "¿cuál era el ítem 100?" sin escarbar en el correo
 * enviado. Los renglones se rearman con `groupLots`, la MISMA agrupación del
 * Excel adjunto: si se agrupara distinto aquí, el número señalaría una tela
 * que no es la que recibió quien tiene el correo.
 */

export interface ReceiptWithItems extends ReceiptForSummary {
  date: Date;
  mailedItemNumbers: Prisma.JsonValue | null;
}

export interface MailedItemRow {
  item: number;
  receiptCode: string;
  receivedOn: string;
  fabric: string;
  shade: string;
  rolls: number | null;
  quantity: number | null;
  unit: string;
  owner: string;
  shipping: string;
  note: string;
}

/**
 * Se avisa en vez de esconder el número: si a la recepción le quitaron o
 * cambiaron rollos después de mandarla, el renglón que llevaba ese número ya
 * no se puede rearmar, pero el número sí salió en un correo y no puede
 * desaparecer de la serie.
 */
const CHANGED_AFTER_SEND = "El renglón cambió después del envío";

/** Un renglón por número de ítem, del más bajo al más alto. */
export function mailedItemRows(receipts: ReceiptWithItems[]): MailedItemRow[] {
  return receipts
    .flatMap(rowsOfReceipt)
    .sort((left, right) => left.item - right.item);
}

function rowsOfReceipt(receipt: ReceiptWithItems): MailedItemRow[] {
  const groups = new Map(groupLots(receipt.lots).map((row) => [row.key, row]));
  const base = {
    receiptCode: receipt.code,
    receivedOn: dayMonthYear(receipt.date),
    shipping: shippingOf(receipt.carrier?.name, receipt.guideNumber),
  };

  // Se recorren los NÚMEROS y no los rollos: un renglón agregado después del
  // último envío todavía no tiene número y no pertenece a este índice.
  return Object.entries(itemNumbersOf(receipt.mailedItemNumbers)).map(
    ([key, item]) => {
      const group = groups.get(key);
      if (!group) return orphanRow(item, base);

      return {
        ...base,
        item,
        fabric: group.fabric,
        shade: group.shade,
        rolls: group.rolls,
        quantity: group.quantity,
        unit: group.unit,
        owner: group.owner,
        note: "",
      };
    },
  );
}

function orphanRow(
  item: number,
  base: Pick<MailedItemRow, "receiptCode" | "receivedOn" | "shipping">,
): MailedItemRow {
  return {
    ...base,
    item,
    fabric: "",
    shade: "",
    rolls: null,
    quantity: null,
    unit: "",
    owner: "",
    note: CHANGED_AFTER_SEND,
  };
}

export const MAILED_ITEM_COLUMNS: XlsxColumn<MailedItemRow>[] = [
  { header: "No. de ítem", value: (row) => row.item, kind: "number", width: 12 },
  { header: "Recepción", value: (row) => row.receiptCode, width: 16 },
  /* Fecha de la RECEPCIÓN, no del correo: la del envío nunca se guardó, y
     poner la de hoy haría parecer que todo se mandó el mismo día. */
  { header: "Fecha de recepción", value: (row) => row.receivedOn, width: 18 },
  { header: "Tela", value: (row) => row.fabric, width: 30 },
  { header: "Tono", value: (row) => row.shade, width: 24 },
  { header: "Rollos", value: (row) => row.rolls, kind: "number" },
  { header: "Metraje / cantidad", value: (row) => row.quantity, kind: "number", width: 18 },
  { header: "Unidad", value: (row) => row.unit, width: 12 },
  { header: "Cliente dueño", value: (row) => row.owner, width: 26 },
  { header: "Paquetería y guía", value: (row) => row.shipping, width: 30 },
  { header: "Nota", value: (row) => row.note, width: 36 },
];
