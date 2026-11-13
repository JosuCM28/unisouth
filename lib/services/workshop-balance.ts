import { BusinessRuleError } from "@/lib/core/errors";
import type {
  PieceCount,
  WorkshopOutputRepository,
} from "@/lib/repositories/workshop-output.repository";

/** Cuánto de una talla va a cada PO, como se capturó en la orden. */
export interface PoPlan {
  clientPo: string | null;
  quantity: number;
}

export interface BalanceSize {
  sizeId: string;
  sizeCode: string;
  /** Lo que sigue en la mesa del taller y todavía puede salir. */
  available: number;
  /** El reparto de la orden por PO, para prellenar la salida a Embarques. */
  poPlan: PoPlan[];
}

export interface WorkshopBalanceOrder {
  orderId: string;
  code: string;
  reference: string | null;
  description: string | null;
  clientId: string | null;
  clientName: string | null;
  sizes: BalanceSize[];
}

/** Saldo por "orden:talla". */
export type BalanceMap = Map<string, number>;

export const balanceKey = (orderId: string, sizeId: string) => `${orderId}:${sizeId}`;

/**
 * Lo que tiene un taller: lo que CONFIRMÓ que recibió menos lo que ya sacó,
 * por orden y talla. No se guarda en ninguna columna: se suma cada vez, y así
 * no hay un saldo que se pueda desfasar de su historia.
 */
export async function computeBalance(
  repo: WorkshopOutputRepository,
  workshopId: string,
  orderId?: string,
): Promise<BalanceMap> {
  const [shipments, vouchers, out] = await Promise.all([
    repo.receivedFromShipments(workshopId, orderId),
    repo.receivedFromVouchers(workshopId, orderId),
    repo.alreadyOut(workshopId, orderId),
  ]);

  const balance: BalanceMap = new Map();
  const add = (counts: PieceCount[], sign: 1 | -1) => {
    for (const { orderId: order, sizeId, pieces } of counts) {
      const key = balanceKey(order, sizeId);
      balance.set(key, (balance.get(key) ?? 0) + sign * pieces);
    }
  };
  add(shipments, 1);
  add(vouchers, 1);
  add(out, -1);
  return balance;
}

/**
 * Ninguna talla puede sacar más de lo que el taller tiene de esa orden. Se
 * suma por talla: en la salida a Embarques la misma talla viene en varios
 * renglones, uno por PO.
 */
export async function assertWithinBalance(
  repo: WorkshopOutputRepository,
  balance: BalanceMap,
  orderId: string,
  lines: { sizeId: string; quantity: number; scrapQuantity: number }[],
): Promise<void> {
  const used = new Map<string, number>();
  for (const line of lines) {
    used.set(line.sizeId, (used.get(line.sizeId) ?? 0) + line.quantity + line.scrapQuantity);
  }

  const availableOf = (sizeId: string) => Math.max(0, balance.get(balanceKey(orderId, sizeId)) ?? 0);
  const short = [...used.entries()].filter(([sizeId, pieces]) => pieces > availableOf(sizeId));
  if (short.length === 0) return;

  const sizes = await repo.findSizes(short.map(([sizeId]) => sizeId));
  const detail = short
    .map(([sizeId]) => `${sizes.find((size) => size.id === sizeId)?.code ?? "?"}: tienes ${availableOf(sizeId)}`)
    .join(" · ");

  throw new BusinessRuleError(
    `Sacas más de lo que tienes de esta orden (${detail}). Si te llegó más, primero márcalo como recibido.`,
  );
}

/** El saldo con nombres y su reparto por PO; sólo lo que todavía tiene piezas. */
export async function describeBalance(
  repo: WorkshopOutputRepository,
  balance: BalanceMap,
): Promise<WorkshopBalanceOrder[]> {
  const live = [...balance.entries()]
    .filter(([, pieces]) => pieces > 0)
    .map(([key, pieces]) => {
      const [orderId = "", sizeId = ""] = key.split(":");
      return { orderId, sizeId, pieces };
    });

  const [orders, sizes] = await Promise.all([
    repo.findOrdersInfo([...new Set(live.map((entry) => entry.orderId))]),
    repo.findSizes([...new Set(live.map((entry) => entry.sizeId))]),
  ]);
  const sizeById = new Map(sizes.map((size) => [size.id, size]));

  return orders
    .map((order) => ({
      orderId: order.id,
      code: order.code,
      reference: order.reference,
      description: order.description,
      clientId: order.clientId,
      clientName: order.client?.name ?? null,
      sizes: live
        .filter((entry) => entry.orderId === order.id)
        .sort((a, b) => (sizeById.get(a.sizeId)?.order ?? 0) - (sizeById.get(b.sizeId)?.order ?? 0))
        .map((entry) => ({
          sizeId: entry.sizeId,
          sizeCode: sizeById.get(entry.sizeId)?.code ?? "?",
          available: entry.pieces,
          poPlan: order.lines
            .filter((line) => line.sizeId === entry.sizeId)
            .flatMap((line) => line.poSplits),
        })),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
