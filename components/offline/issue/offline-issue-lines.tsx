"use client";

import { X } from "lucide-react";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import type { OfflineLot, OfflineMaterial } from "@/lib/offline/snapshot.types";
import { formatQuantity } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Un renglón de la salida: el rollo y lo que se le saca, como se teclea. */
export interface DraftLine {
  lot: OfflineLot;
  /** Texto y no número: es lo que trae el input, con coma o a medias. */
  quantity: string;
  /** El disponible estimado al agregarlo, sin contar esta misma salida. */
  available: number;
}

/** La cantidad tecleada como número; NaN si no se puede leer. */
export function parseQuantity(raw: string): number {
  return Number(raw.replace(",", "."));
}

/** ¿Por qué no se puede guardar este renglón? `null` si está bien. */
export function lineProblem(line: DraftLine): string | null {
  const quantity = parseQuantity(line.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Escribe cuánto sale";
  }

  // Se bloquea aquí y no sólo en el servidor: sin señal el auxiliar no se
  // enteraría del rechazo hasta mañana, con el material ya entregado.
  if (quantity > line.available) {
    return "Es más de lo que queda en la copia";
  }

  return null;
}

export function OfflineIssueLines({
  lines,
  materials,
  onChange,
  onRemove,
}: {
  lines: DraftLine[];
  materials: Map<string, OfflineMaterial>;
  onChange: (lotId: string, quantity: string) => void;
  onRemove: (lotId: string) => void;
}) {
  if (lines.length === 0) {
    return (
      <p className="flat-surface px-3 py-6 text-center text-sm text-muted-foreground">
        Agrega los rollos que salen.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {lines.map((line) => (
        <LineRow
          key={line.lot.id}
          line={line}
          material={materials.get(line.lot.materialId)}
          onChange={onChange}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}

function LineRow({
  line,
  material,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  material: OfflineMaterial | undefined;
  onChange: (lotId: string, quantity: string) => void;
  onRemove: (lotId: string) => void;
}) {
  const unit = UNIT_SHORT_LABELS[line.lot.unit];
  const problem = line.quantity ? lineProblem(line) : null;

  return (
    <li className="flat-surface flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular text-sm font-medium">{line.lot.code}</p>
          <p className="truncate text-xs text-muted-foreground">
            {material?.name ?? "Material"} · quedan{" "}
            <span className="tabular">
              {formatQuantity(line.available, { unit })}
            </span>
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target shrink-0"
          aria-label={`Quitar ${line.lot.code}`}
          onClick={() => onRemove(line.lot.id)}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          placeholder="0"
          value={line.quantity}
          onChange={(event) => onChange(line.lot.id, event.target.value)}
          className="touch-target tabular"
          aria-label={`Cantidad que sale de ${line.lot.code}`}
          aria-invalid={Boolean(problem)}
        />
        <span className="shrink-0 text-sm text-muted-foreground">{unit}</span>
      </div>

      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </li>
  );
}
