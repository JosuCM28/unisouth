/** Un renglón de una orden que puede recibir piezas de una talla. */
export interface AllocationTarget {
  orderId: string;
  orderCode: string;
  lineId: string;
  /** Clave de la talla: es lo que junta renglones de órdenes distintas. */
  sizeKey: string;
  /** Lo que todavía le falta cortar. Nunca negativo. */
  pending: number;
}

/** Bultos capturados de una talla, sin decir todavía de qué orden son. */
export interface CapturedBundles {
  sizeKey: string;
  /** Piezas POR BULTO. */
  quantity: number;
  bundles: number;
  tagId?: string;
}

/** Lo que le toca a un renglón de una orden. */
export interface Allocation {
  orderId: string;
  orderCode: string;
  lineId: string;
  sizeKey: string;
  /** Piezas por bulto. */
  quantity: number;
  bundles: number;
  tagId?: string;
}

export interface AllocationResult {
  allocations: Allocation[];
  /** Piezas que rebasan lo pedido en TODAS las órdenes de esa talla. */
  surplus: { sizeKey: string; pieces: number }[];
  /** Tallas capturadas que ninguna orden del pedido lleva. */
  unmatched: string[];
}

/**
 * Reparte lo capturado por talla entre las órdenes que la piden.
 *
 * Se llena cada orden hasta completar lo que le falta, en el orden en que
 * vienen, y sólo cuando TODAS quedan completas lo que sobra se queda en la
 * última: cortar de más pasa de verdad y hay que registrarlo, pero nunca a
 * costa de dejar corta a una orden que todavía necesitaba piezas.
 *
 * Se reparte BULTO por bulto porque es la unidad física que se amarra. Un
 * bulto que no cabe entero en lo que falta a una orden se parte: lo que
 * cubre la orden va a ella y el resto pasa a la siguiente como otro bulto.
 * Partir es lo que hace que los totales cuadren exacto con lo pedido.
 */
export function allocateBySize(
  targets: AllocationTarget[],
  captured: CapturedBundles[],
): AllocationResult {
  const remaining = new Map(targets.map((t) => [t.lineId, t.pending]));
  const byKey = new Map<string, AllocationTarget[]>();
  for (const target of targets) {
    byKey.set(target.sizeKey, [...(byKey.get(target.sizeKey) ?? []), target]);
  }

  // Bultos con la misma orden, cantidad y color se juntan en un renglón.
  const grouped = new Map<string, Allocation>();
  const surplus = new Map<string, number>();
  const unmatched = new Set<string>();

  function assign(target: AllocationTarget, pieces: number, tagId?: string) {
    const key = `${target.lineId}|${pieces}|${tagId ?? ""}`;
    const current = grouped.get(key);

    if (current) {
      current.bundles += 1;
      return;
    }

    grouped.set(key, {
      orderId: target.orderId,
      orderCode: target.orderCode,
      lineId: target.lineId,
      sizeKey: target.sizeKey,
      quantity: pieces,
      bundles: 1,
      tagId,
    });
  }

  for (const entry of captured) {
    const sizeTargets = byKey.get(entry.sizeKey);

    if (!sizeTargets || sizeTargets.length === 0) {
      unmatched.add(entry.sizeKey);
      continue;
    }

    for (let bundle = 0; bundle < entry.bundles; bundle += 1) {
      let left = entry.quantity;

      while (left > 0) {
        const open = sizeTargets.find(
          (target) => (remaining.get(target.lineId) ?? 0) > 0,
        );

        if (!open) {
          const last = sizeTargets[sizeTargets.length - 1]!;
          assign(last, left, entry.tagId);
          surplus.set(entry.sizeKey, (surplus.get(entry.sizeKey) ?? 0) + left);
          break;
        }

        const take = Math.min(left, remaining.get(open.lineId) ?? 0);
        assign(open, take, entry.tagId);
        remaining.set(open.lineId, (remaining.get(open.lineId) ?? 0) - take);
        left -= take;
      }
    }
  }

  return {
    allocations: [...grouped.values()],
    surplus: [...surplus].map(([sizeKey, pieces]) => ({ sizeKey, pieces })),
    unmatched: [...unmatched],
  };
}
