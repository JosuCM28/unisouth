import { formatDate } from "@/lib/utils";
import type { VoucherField, VoucherSheet } from "./voucher-sheet";

/**
 * EL CORREO DEL VALE: asunto y cuerpo en texto plano, a partir de la hoja.
 *
 * Funciones puras sobre VoucherSheet y no sobre el documento, por la misma
 * razón que existe la hoja: lo que dice el correo y lo que dice el PDF
 * adjunto salen de las mismas decisiones, y no pueden contradecirse.
 */

/** Lo que se busca en la bandeja: el número de orden, como se habla en el piso. */
export function voucherEmailSubject(sheet: VoucherSheet): string {
  return `SALIDA DE CORTE ${orderOf(sheet) ?? sheet.code}`;
}

/**
 * El cuerpo: todo el encabezado del vale, renglón por renglón.
 *
 * Texto plano y no HTML: se lee igual en el celular del taller que en
 * cualquier cliente de correo, y ningún filtro lo manda a spam por traer
 * estilos. Quien lo recibe sabe de qué se trata sin abrir el PDF.
 */
export function voucherEmailText(sheet: VoucherSheet): string {
  const blocks = [
    [voucherEmailSubject(sheet)],
    lines([
      { label: "Folio", value: sheet.code },
      { label: "Fecha", value: formatDate(sheet.date) },
    ]),
    section("ENCABEZADO", lines(sheet.header)),
    section("TOTALES", totalsOf(sheet)),
    section("NOTAS DEL CORTE", numbered(sheet.cutNotes)),
    section("DATOS DEL VALE", lines(footerOf(sheet))),
    [
      `Se adjunta el vale en PDF (${sheet.code}.pdf).`,
      "",
      "Mensaje automático de UNISOUTH. No respondas a este correo.",
    ],
  ];

  return blocks
    .filter((block) => block.length > 0)
    .map((block) => block.join("\n"))
    .join("\n\n");
}

function orderOf(sheet: VoucherSheet): string | null {
  return sheet.header.find((field) => field.label === "Orden")?.value ?? null;
}

function lines(fields: VoucherField[]): string[] {
  return fields.map((field) => `${field.label}: ${field.value}`);
}

/** Un bloque con su título, o nada si no trae renglones. */
function section(title: string, body: string[]): string[] {
  return body.length > 0 ? [title, ...body] : [];
}

function numbered(notes: string[]): string[] {
  return notes.map((note, index) => `${index + 1}. ${note}`);
}

/** Prendas y tela: lo que se coteja contra el bulto que llega. */
function totalsOf(sheet: VoucherSheet): string[] {
  const totals: string[] = [];

  if (sheet.cutRows.length > 0) {
    const { pieces, bundles } = sheet.cutTotals;
    const sizes = sheet.cutRows.map((row) => `${row.sizeCode}: ${row.total}`);
    totals.push(`Prendas: ${pieces} en ${bundles} bultos`);
    totals.push(`Por talla: ${sizes.join(" · ")}`);
  }

  if (sheet.rollSummary) totals.push(`Tela: ${sheet.rollSummary}`);

  return totals;
}

/** El pie de la hoja, más quién entregó y quién recibió. */
function footerOf(sheet: VoucherSheet): VoucherField[] {
  const extra: [string, string | null][] = [
    ["Entregó", sheet.handedOverBy],
    ["Recibió", sheet.receivedBy],
    ["Observaciones", sheet.notes],
  ];

  return [
    ...sheet.footer,
    ...extra.flatMap(([label, value]) => (value ? [{ label, value }] : [])),
  ];
}
