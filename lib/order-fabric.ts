import type { DocumentStatus, Unit } from "@prisma/client";

/** Un vale que movió tela de esta orden: la salida o su devolución. */
export interface FabricDocument {
  id: string;
  code: string;
  kind: "ISSUE" | "RETURN";
  status: DocumentStatus;
  date: Date;
  lines: {
    lotId: string;
    lotCode: string;
    shade: string | null;
    materialName: string;
    unit: Unit;
    quantity: number;
  }[];
}

/** Lo que un rollo concreto lleva de esta orden. */
export interface FabricRollBalance {
  lotId: string;
  lotCode: string;
  shade: string | null;
  materialName: string;
  unit: Unit;
  out: number;
  returned: number;
  /** Lo que sigue en producción: salió y no ha vuelto. */
  net: number;
}

/** Los totales de una unidad. Una orden normal sólo tiene metros. */
export interface FabricUnitTotal {
  unit: Unit;
  rollsOut: number;
  rollsReturned: number;
  out: number;
  returned: number;
  net: number;
}

export interface FabricSummary {
  rolls: FabricRollBalance[];
  totals: FabricUnitTotal[];
}

/**
 * Suma lo que la orden se llevó y lo que regresó, rollo por rollo.
 *
 * SÓLO cuenta vales APLICADOS: un borrador no ha movido un metro del kárdex y
 * sumarlo haría que el consumo de la orden dijera algo que el inventario no
 * dice. Los cancelados tampoco: su movimiento inverso ya deshizo el efecto.
 */
export function summarizeFabric(documents: FabricDocument[]): FabricSummary {
  const byLot = new Map<string, FabricRollBalance>();

  for (const document of documents) {
    if (document.status !== "APPLIED") continue;

    for (const line of document.lines) {
      const roll = byLot.get(line.lotId) ?? {
        lotId: line.lotId,
        lotCode: line.lotCode,
        shade: line.shade,
        materialName: line.materialName,
        unit: line.unit,
        out: 0,
        returned: 0,
        net: 0,
      };

      if (document.kind === "ISSUE") roll.out += line.quantity;
      else roll.returned += line.quantity;

      roll.net = roll.out - roll.returned;
      byLot.set(line.lotId, roll);
    }
  }

  const rolls = [...byLot.values()].sort((a, b) =>
    a.lotCode.localeCompare(b.lotCode),
  );

  const byUnit = new Map<Unit, FabricUnitTotal>();
  for (const roll of rolls) {
    const total = byUnit.get(roll.unit) ?? {
      unit: roll.unit,
      rollsOut: 0,
      rollsReturned: 0,
      out: 0,
      returned: 0,
      net: 0,
    };

    if (roll.out > 0) total.rollsOut += 1;
    if (roll.returned > 0) total.rollsReturned += 1;
    total.out += roll.out;
    total.returned += roll.returned;
    total.net += roll.net;
    byUnit.set(roll.unit, total);
  }

  return { rolls, totals: [...byUnit.values()] };
}
