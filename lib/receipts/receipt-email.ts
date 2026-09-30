import { formatQuantity } from "@/lib/utils";
import type { ReceiptSummary } from "./receipt-summary";

/**
 * EL CORREO DE LA RECEPCIÓN: asunto y cuerpo en texto plano.
 *
 * El cuerpo repite lo del Excel en corto para que se lea sin abrir el
 * adjunto desde el celular; el Excel es el que se archiva.
 */

export function receiptEmailSubject(summary: ReceiptSummary): string {
  return `RECEPCIÓN DE TELA ${summary.code}`;
}

export function receiptEmailText(summary: ReceiptSummary): string {
  const header = [
    `RECEPCIÓN DE TELA ${summary.code}`,
    `Fecha: ${summary.sentOn}`,
    `Paquetería y guía: ${summary.shipping}`,
    `Rollos recibidos: ${summary.totalRolls}`,
  ];

  const detail = summary.rows.map((row) =>
    [
      `Ítem ${row.item}. ${row.fabric}`,
      `   Tono: ${row.shade}`,
      `   Rollos: ${row.rolls} · Cantidad: ${formatQuantity(row.quantity, { unit: row.unitShort })}`,
      `   Cliente dueño: ${row.owner}`,
    ].join("\n"),
  );

  return [
    header.join("\n"),
    ["DETALLE", ...detail].join("\n"),
    "Se adjunta el detalle en Excel, una fila por tela y tono.",
    "Mensaje automático de UNISOUTH. No respondas a este correo.",
  ].join("\n\n");
}
