import type { SplitBundle } from "./workshop-split";

/** Cuántas piezas de un lado del reparto son de cierta orden. */
export interface OrderPieces {
  orderCode: string;
  pieces: number;
}

/**
 * De qué orden son las piezas de una talla en un lado del reparto.
 *
 * En un pedido la talla viaja completa a un taller aunque la pidan varias
 * órdenes, así que el número del renglón junta folios. Al armar las salidas
 * hay que separarlas de nuevo, porque cada envío nace por orden.
 *
 * Un bulto de corte global puede ser de varias órdenes: ahí manda `parts`,
 * no el folio del bulto. Sin folio (una orden suelta) no hay nada que desglosar.
 */
export function piecesByOrder(bundles: SplitBundle[]): OrderPieces[] {
  const totals = new Map<string, number>();

  for (const bundle of bundles) {
    for (const share of shares(bundle)) {
      totals.set(share.orderCode, (totals.get(share.orderCode) ?? 0) + share.pieces);
    }
  }

  return [...totals.entries()]
    .map(([orderCode, pieces]) => ({ orderCode, pieces }))
    .sort((a, b) => a.orderCode.localeCompare(b.orderCode, "es", { numeric: true }));
}

/** Lo que aporta un renglón de bultos a cada orden. */
function shares(bundle: SplitBundle): OrderPieces[] {
  if (bundle.parts && bundle.parts.length > 0) {
    return bundle.parts.map((part) => ({
      orderCode: part.orderCode,
      pieces: part.pieces * bundle.count,
    }));
  }
  if (!bundle.orderCode) return [];

  return [{ orderCode: bundle.orderCode, pieces: bundle.pieces * bundle.count }];
}

/** "PO-2026-0246: 100 · PO-2026-0244: 128", para leerlo o copiarlo. */
export function describeOrders(orders: OrderPieces[]): string {
  return orders.map((order) => `${order.orderCode}: ${order.pieces}`).join(" · ");
}
