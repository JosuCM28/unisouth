import type { Unit } from "@prisma/client";
import { UNIT_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { toXlsx, type XlsxColumn } from "@/lib/export/xlsx";
import { APP_TIMEZONE } from "@/lib/utils";

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

/**
 * La serie del número de ítem y dónde arranca.
 *
 * Arranca en 54 porque se venía numerando a mano y el sistema continúa donde
 * se quedó el papel. Corre de corrido entre recepciones y entre años.
 */
export const ITEM_SERIES = "RECEIPT_EMAIL_ITEM";
export const FIRST_ITEM_NUMBER = 54;

/** Lo mínimo de la recepción que el resumen necesita. */
export interface ReceiptForSummary {
  code: string;
  guideNumber: string | null;
  carrier: { name: string } | null;
  lots: {
    unit: Unit;
    initialQuantity: unknown;
    shade: string | null;
    material: { id: string; name: string };
    client: { name: string } | null;
  }[];
}

export interface ReceiptSummaryRow {
  /** Identifica el renglón entre envíos, para conservar su número de ítem. */
  key: string;
  item: number;
  fabric: string;
  shade: string;
  rolls: number;
  quantity: number;
  unit: string;
  /** "m", "kg": para el cuerpo del correo, donde "89.5 Metro" se lee mal. */
  unitShort: string;
  owner: string;
}

export interface ReceiptSummary {
  code: string;
  /** La fecha del envío, ya como día/mes/año. */
  sentOn: string;
  /** Paquetería y guía en un solo dato, como se rastrea el envío. */
  shipping: string;
  rows: ReceiptSummaryRow[];
  totalRolls: number;
}

type GroupedRow = Omit<ReceiptSummaryRow, "item">;

/** Las llaves de los renglones, en orden: a éstas se les aparta número. */
export function receiptRowKeys(receipt: ReceiptForSummary): string[] {
  return groupLots(receipt.lots).map((row) => row.key);
}

export function summarizeReceipt(
  receipt: ReceiptForSummary,
  itemNumbers: Record<string, number>,
  sentAt: Date,
): ReceiptSummary {
  return {
    code: receipt.code,
    sentOn: dayMonthYear(sentAt),
    shipping: shippingOf(receipt.carrier?.name, receipt.guideNumber),
    rows: groupLots(receipt.lots).map((row) => ({
      ...row,
      item: itemNumbers[row.key] ?? 0,
    })),
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
function groupLots(lots: ReceiptForSummary["lots"]): GroupedRow[] {
  const groups = new Map<string, GroupedRow>();

  for (const lot of lots) {
    const shade = lot.shade || MISSING_INFO;
    const owner = lot.client?.name || MISSING_INFO;
    const key = [lot.material.id, lot.unit, shade, owner].join("|");

    const row = groups.get(key) ?? {
      key,
      fabric: lot.material.name,
      shade,
      rolls: 0,
      quantity: 0,
      unit: UNIT_LABELS[lot.unit],
      unitShort: UNIT_SHORT_LABELS[lot.unit],
      owner,
    };

    row.rolls += 1;
    row.quantity += Number(lot.initialQuantity);
    groups.set(key, row);
  }

  return [...groups.values()];
}

/**
 * "DHL · Guía 4471-8820". Si falta una de las dos se dice cuál; si faltan
 * las dos, sólo la leyenda.
 */
function shippingOf(
  carrier: string | null | undefined,
  guide: string | null,
): string {
  if (carrier && guide) return `${carrier} · Guía ${guide}`;
  if (carrier) return `${carrier} · Guía: ${MISSING_INFO}`;
  if (guide) return `Guía ${guide} · Paquetería: ${MISSING_INFO}`;
  return MISSING_INFO;
}

/**
 * Día/mes/año en la zona de la fábrica, como TEXTO.
 *
 * Texto y no celda de fecha: el formato de una fecha en Excel lo decide la
 * configuración de quien abre, y en una máquina en inglés saldría mes/día.
 * Aquí se pidió día/mes/año y así tiene que leerse en cualquier equipo.
 */
function dayMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

const COLUMNS: XlsxColumn<ReceiptSummaryRow & { sentOn: string; shipping: string }>[] = [
  { header: "No. de ítem", value: (row) => row.item, kind: "number", width: 12 },
  { header: "Fecha", value: (row) => row.sentOn, width: 12 },
  { header: "Tela", value: (row) => row.fabric, width: 30 },
  { header: "Tono", value: (row) => row.shade, width: 24 },
  { header: "Rollos", value: (row) => row.rolls, kind: "number" },
  { header: "Metraje / cantidad", value: (row) => row.quantity, kind: "number", width: 18 },
  { header: "Unidad", value: (row) => row.unit, width: 12 },
  { header: "Cliente dueño", value: (row) => row.owner, width: 26 },
  { header: "Paquetería y guía", value: (row) => row.shipping, width: 30 },
];

/** El Excel adjunto: una tabla con filtro, fila por fila. */
export function receiptSummaryXlsx(summary: ReceiptSummary): Buffer {
  const rows = summary.rows.map((row) => ({
    ...row,
    sentOn: summary.sentOn,
    shipping: summary.shipping,
  }));

  return toXlsx(rows, COLUMNS, "Recepción");
}

export function receiptSummaryFileName(summary: ReceiptSummary): string {
  return `recepcion-${summary.code}.xlsx`;
}
