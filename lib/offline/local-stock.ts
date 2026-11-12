import type { QueuedItem } from "./queue";
import type { OfflineLot } from "./snapshot.types";

/**
 * El saldo que se enseña SIN señal: la copia menos lo que ya salió en
 * salidas que todavía no se suben.
 *
 * Es un ESTIMADO y sólo vive en pantalla. `Lot.currentQuantity` nunca se
 * escribe en el navegador —la regla 1 de integridad—: el saldo real lo
 * calcula `InventoryService` al subir, con la fila bloqueada. Esto sólo
 * evita que el mismo celular ofrezca dos veces los mismos metros: sin
 * restar lo pendiente, dos salidas offline seguidas podrían tomar 40 m cada
 * una de un rollo de 50 y la segunda rebotaría al subir.
 */

/** Lo que un payload de salida offline trae por renglón. */
interface PendingIssueLine {
  lotId: string;
  quantity: number | string;
}

/** Metros (o piezas) comprometidos por rollo en las salidas pendientes. */
export function pendingIssuedByLot(items: QueuedItem[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const item of items) {
    if (item.kind !== "issue.create") continue;

    for (const line of issueLinesOf(item.payload)) {
      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity)) continue;
      totals.set(line.lotId, (totals.get(line.lotId) ?? 0) + quantity);
    }
  }

  return totals;
}

/** Disponible estimado = saldo − reservado − lo pendiente de subir. */
export function estimatedAvailable(
  lot: OfflineLot,
  pendingByLot: Map<string, number>,
): number {
  const pending = pendingByLot.get(lot.id) ?? 0;
  return lot.currentQuantity - lot.reservedQuantity - pending;
}

/**
 * Los renglones de un payload de la cola.
 *
 * La cola guarda `unknown` —el mismo payload que recibe la action—, así que
 * se lee con cuidado: un payload que no tenga la forma esperada no aporta
 * nada en vez de reventar la pantalla.
 */
function issueLinesOf(payload: unknown): PendingIssueLine[] {
  if (!payload || typeof payload !== "object" || !("document" in payload)) {
    return [];
  }

  const document = payload.document;
  if (!document || typeof document !== "object" || !("lines" in document)) {
    return [];
  }

  return Array.isArray(document.lines) ? (document.lines as PendingIssueLine[]) : [];
}
