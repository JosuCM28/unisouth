"use client";

import type { DraftBox } from "@/lib/packing/packing-list-draft";
import { Input } from "@/components/ui/input";

/**
 * Peso y medidas de cada caja, para la paquetería. Opcionales: salen en el
 * subtotal de la caja sólo si se llenan.
 */
export function PackingListEditorBoxes({
  boxes,
  onChange,
  readOnly,
}: {
  boxes: DraftBox[];
  onChange: (boxes: DraftBox[]) => void;
  readOnly: boolean;
}) {
  if (boxes.length === 0) return null;

  function update(boxNumber: number, patch: Partial<DraftBox>) {
    onChange(boxes.map((box) => (box.boxNumber === boxNumber ? { ...box, ...patch } : box)));
  }

  return (
    <section className="flat-surface flex flex-col gap-2 p-4">
      <h2 className="text-sm font-semibold">Peso y medidas por caja</h2>
      <div className="grid grid-cols-[3.5rem_1fr_1fr] gap-2 text-xs text-muted-foreground">
        <span>Caja</span>
        <span>Peso (kg)</span>
        <span>Medidas</span>
      </div>
      {boxes.map((box) => (
        <div key={box.boxNumber} className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-2">
          <span className="tabular text-sm font-medium">{box.boxNumber}</span>
          <Input inputMode="decimal" aria-label={`Peso de la caja ${box.boxNumber}`} placeholder="0.00"
            value={box.weightKg} readOnly={readOnly}
            onChange={(event) => update(box.boxNumber, { weightKg: event.target.value })}
            className="tabular touch-target" />
          <Input aria-label={`Medidas de la caja ${box.boxNumber}`} placeholder="60X40X40"
            value={box.dimensions} readOnly={readOnly}
            onChange={(event) => update(box.boxNumber, { dimensions: event.target.value })}
            className="touch-target uppercase" />
        </div>
      ))}
    </section>
  );
}
