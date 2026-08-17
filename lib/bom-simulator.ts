import { combineWaste, computeLineConsumption } from "@/lib/services/calculation.service";

export interface SimulatorLine {
  materialName: string;
  unit: string;
  consumptionPerUnit: number;
  wastePct: number;
  isFixedQuantity: boolean;
  hasOwnSize: boolean;
}

export interface SimulatedRow {
  materialName: string;
  unit: string;
  base: number;
  wastePct: number;
  required: number;
}

/**
 * Simulación en vivo: "si produzco N piezas, necesito esto".
 *
 * Corre EN EL CLIENTE y no guarda nada. Usa las mismas funciones puras que
 * el motor del servidor, así que lo que muestra el simulador es lo que va a
 * calcular el servidor de verdad.
 */
export function simulate(
  lines: SimulatorLine[],
  quantity: number,
  globalWastePct: number,
  sizeFactor = 1,
): SimulatedRow[] {
  if (quantity <= 0) return [];

  return lines.map((line) => {
    const base = computeLineConsumption({
      consumptionPerUnit: line.consumptionPerUnit,
      quantity,
      sizeFactor,
      isFixedQuantity: line.isFixedQuantity,
      hasOwnSize: line.hasOwnSize,
    });

    const wastePct = combineWaste(line.wastePct, globalWastePct);
    const required = Math.round(base * (1 + wastePct / 100) * 10_000) / 10_000;

    return {
      materialName: line.materialName,
      unit: line.unit,
      base,
      wastePct,
      required,
    };
  });
}
