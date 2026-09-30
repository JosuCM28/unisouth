import type { Unit } from "@prisma/client";
import { UNIT_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { toXlsx, type XlsxColumn } from "@/lib/export/xlsx";

/**
 * LO QUE LLEGÓ EN UNA RECEPCIÓN, como se le cuenta a alguien de fuera.
 *
 * Un renglón por tela + tono + dueño, no por rollo: quien recibe el correo
 * coteja contra su remisión —"12 rollos de gabardina tono 3, 540 m"—, y
 * cuarenta renglones de rollo sueltos lo obligarían a sumar a mano.
 *
 * Funciones puras sobre los rollos ya leídos: el Excel adjunto y el cuerpo del
 * correo salen de los MISMOS renglones y no pueden contradecirse.
 */

/**
 * Lo que se escribe donde falta un dato.
 *
 * No se deja la celda vacía ni con guion: el correo sale a gente de fuera, y
 * un hueco se lee como descuido nuestro. La leyenda dice qué hacer con él.
 */
export const MISSING_INFO =
  "Favor de contactarnos para ayudarnos a trazar esta información";

/** Lo mínimo de la recepción que el resumen necesita. */
export interface ReceiptForSummary {
  code: string;
  date: Date;
  guideNumber: string | null;
  carrier: { name: string } | null;
  lots: {
    unit: Unit;
    initialQuantity: unknown;
    shade: string | null;
    material: { id: string; name: string; code: string };
    client: { name: string } | null;
  }[];
}

export interface ReceiptSummaryRow {
  fabric: string;
  fabricCode: string;
  shade: string;
  rolls: number;
  quantity: number;
  unit: string;
  /** "m", "kg": para el cuerpo del correo, donde "89.5 Metro" se lee mal. */
  unitShort: string;
  guide: string;
  carrier: string;
  owner: string;
}

export interface ReceiptSummary {
  code: string;
  date: Date;
  guide: string;
  carrier: string;
  rows: ReceiptSummaryRow[];
  totalRolls: number;
}

export function summarizeReceipt(receipt: ReceiptForSummary): ReceiptSummary {
  const guide = receipt.guideNumber || MISSING_INFO;
  const carrier = receipt.carrier?.name || MISSING_INFO;

  return {
    code: receipt.code,
    date: receipt.date,
    guide,
    carrier,
    rows: groupLots(receipt.lots, guide, carrier),
    totalRolls: receipt.lots.length,
  };
}

/**
 * Agrupa por tela, unidad, tono y dueño.
 *
 * La unidad entra en la llave porque la misma tela capturada en metros y en
 * kilos son dos cifras que sumadas no significan nada. El dueño también: una
 * guía puede traer tela de dos clientes, y juntarla en un renglón le diría a
 * uno que recibió lo del otro.
 */
function groupLots(
  lots: ReceiptForSummary["lots"],
  guide: string,
  carrier: string,
): ReceiptSummaryRow[] {
  const groups = new Map<string, ReceiptSummaryRow>();

  for (const lot of lots) {
    const shade = lot.shade || MISSING_INFO;
    const owner = lot.client?.name || MISSING_INFO;
    const key = [lot.material.id, lot.unit, shade, owner].join("|");

    const row = groups.get(key) ?? {
      fabric: lot.material.name,
      fabricCode: lot.material.code,
      shade,
      rolls: 0,
      quantity: 0,
      unit: UNIT_LABELS[lot.unit],
      unitShort: UNIT_SHORT_LABELS[lot.unit],
      guide,
      carrier,
      owner,
    };

    row.rolls += 1;
    row.quantity += Number(lot.initialQuantity);
    groups.set(key, row);
  }

  return [...groups.values()];
}

const COLUMNS: XlsxColumn<ReceiptSummaryRow>[] = [
  { header: "Tela", value: (row) => row.fabric, width: 30 },
  { header: "Código", value: (row) => row.fabricCode, width: 14 },
  { header: "Tono", value: (row) => row.shade, width: 24 },
  { header: "Rollos", value: (row) => row.rolls, kind: "number" },
  { header: "Cantidad", value: (row) => row.quantity, kind: "number" },
  { header: "Unidad", value: (row) => row.unit, width: 12 },
  { header: "Guía", value: (row) => row.guide, width: 20 },
  { header: "Paquetería", value: (row) => row.carrier, width: 20 },
  { header: "Cliente dueño", value: (row) => row.owner, width: 26 },
];

/**
 * El Excel adjunto: una tabla con filtro, fila por fila.
 *
 * Guía y paquetería se repiten en cada renglón a propósito: quien recibe el
 * archivo suele pegarlo en su propio control, y un renglón que no dice de
 * qué guía vino pierde el dato en cuanto se separa de los demás.
 */
export function receiptSummaryXlsx(summary: ReceiptSummary): Buffer {
  return toXlsx(summary.rows, COLUMNS, "Recepción");
}

export function receiptSummaryFileName(summary: ReceiptSummary): string {
  return `recepcion-${summary.code}.xlsx`;
}
