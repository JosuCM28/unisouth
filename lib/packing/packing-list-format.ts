import type { PackingList, PackingListBoxGroup } from "./packing-list";

/**
 * Los textos de los renglones de total. Uno solo para el Excel y el PDF,
 * para que el papel y el archivo digan lo mismo.
 */

/** "12.50 KG · 60X40X40"; vacío si no se capturó nada. */
export function formatBoxExtras(group: Pick<PackingListBoxGroup, "weightKg" | "dimensions">): string {
  const parts: string[] = [];
  if (group.weightKg !== null) parts.push(`${group.weightKg.toFixed(2)} KG`);
  if (group.dimensions) parts.push(group.dimensions);
  return parts.join(" · ");
}

/** "SUBTOTAL CAJA 2 · 12.50 KG · 60X40X40". */
export function subtotalLabel(group: PackingListBoxGroup): string {
  const head = group.boxNumber === null ? "SIN CAJA" : `SUBTOTAL CAJA ${group.boxNumber}`;
  return [head, formatBoxExtras(group)].filter(Boolean).join(" · ");
}

/** "TOTAL · 4 CAJAS · 48.00 KG". */
export function grandTotalLabel(list: PackingList): string {
  const parts = [`TOTAL · ${list.totalBoxes} ${list.totalBoxes === 1 ? "CAJA" : "CAJAS"}`];
  if (list.totalWeightKg !== null) parts.push(`${list.totalWeightKg.toFixed(2)} KG`);
  return parts.join(" · ");
}
