import type { WorkshopDeliveryRow } from "@/lib/services/workshop-delivery.service";

/**
 * Minúsculas y sin acentos: en el piso se escribe "camisa", "CAMISA" o
 * "Camisá" con guantes, y las tres tienen que encontrar lo mismo.
 */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * El texto en el que se busca. Una cancelada viaja sin datos a propósito, así
 * que sólo se encuentra por su folio: buscarla por empresa sería enseñar un
 * dato que el servidor ya decidió no mandar.
 */
function searchableText(row: WorkshopDeliveryRow): string {
  if (row.state === "CANCELLED") return normalize(row.code);

  return normalize(
    [
      row.code,
      row.orderReference,
      row.clientPo ?? "",
      row.clientName,
      row.description,
      row.stageName,
    ].join(" "),
  );
}

/**
 * Filtra por cualquier cosa que se escriba: folio, orden, empresa, prenda o
 * PO del cliente.
 *
 * Cada palabra tiene que aparecer, en cualquier campo y en cualquier orden:
 * "ternium camisa" encuentra las camisas de Ternium sin que el taller tenga
 * que saber en qué columna vive cada dato.
 */
export function filterDeliveries(
  rows: WorkshopDeliveryRow[],
  query: string,
): WorkshopDeliveryRow[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return rows;

  return rows.filter((row) => {
    const text = searchableText(row);
    return terms.every((term) => text.includes(term));
  });
}
