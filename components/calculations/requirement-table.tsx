"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, MapPin, ShoppingCart } from "lucide-react";
import type { RequirementResult } from "@/lib/services/calculation.service";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { cn, formatQuantity } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Unit } from "@prisma/client";

interface RequirementTableProps {
  requirements: RequirementResult[];
  onGeneratePurchaseRequest?: () => void;
}

/**
 * El resultado del cálculo, material por material.
 *
 * Cada fila se puede desplegar para ver de QUÉ rollos sale el material y en
 * qué ubicación están: sin eso, el auxiliar tendría el número pero no sabría
 * a qué fila ir por él.
 */
export function RequirementTable({
  requirements,
  onGeneratePurchaseRequest,
}: RequirementTableProps) {
  const shortages = requirements.filter((r) => !r.sufficient);

  return (
    <div className="flex flex-col gap-3">
      {shortages.length > 0 && onGeneratePurchaseRequest && (
        <div className="flat-surface flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-sm">
            <span className="tabular font-medium">{shortages.length}</span>{" "}
            {shortages.length === 1 ? "material falta" : "materiales faltan"}.
          </p>
          <Button onClick={onGeneratePurchaseRequest} className="touch-target">
            <ShoppingCart className="size-4" aria-hidden />
            Generar requisición
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {requirements.map((requirement) => (
          <RequirementRow key={requirement.materialId} requirement={requirement} />
        ))}
      </ul>
    </div>
  );
}

function RequirementRow({ requirement }: { requirement: RequirementResult }) {
  const [expanded, setExpanded] = useState(false);
  const unitLabel = UNIT_SHORT_LABELS[requirement.unit as Unit] ?? requirement.unit;

  return (
    <li className="flat-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-3 text-left transition-colors active:bg-accent"
      >
        {/* Semáforo: alcanza o no alcanza. Es lo primero que se mira. */}
        <StatusDot sufficient={requirement.sufficient} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{requirement.materialName}</p>
          <p className="tabular text-xs text-muted-foreground">
            {requirement.materialCode}
            {requirement.appliedWastePct > 0 &&
              ` · merma ${formatQuantity(requirement.appliedWastePct)}%`}
          </p>

          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <Cell label="Requerido" value={formatQuantity(requirement.requiredQuantity)} strong />
            <Cell label="Disponible" value={formatQuantity(requirement.availableStock)} />
            <Cell
              label="Falta"
              value={formatQuantity(requirement.shortage)}
              tone={requirement.shortage > 0 ? "danger" : "muted"}
            />
          </dl>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground">{unitLabel}</span>
          <ChevronDown
            className={cn("size-4 transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        </div>
      </button>

      {requirement.warnings.length > 0 && (
        <div className="border-t border-border px-3 py-2">
          {requirement.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-1.5 text-xs text-state-reserved">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {warning}
            </p>
          ))}
        </div>
      )}

      {expanded && (
        <div className="border-t border-border p-3">
          <p className="mb-2 text-xs font-medium">
            De dónde sale ({requirement.suggestedLots.length}{" "}
            {requirement.suggestedLots.length === 1 ? "rollo" : "rollos"})
          </p>

          {requirement.suggestedLots.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay rollos disponibles de este material.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {requirement.suggestedLots.map((lot) => (
                <li key={lot.lotId} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="tabular font-medium">{lot.code}</span>
                    {lot.isRemnant && (
                      <span className="rounded bg-state-remnant px-1 text-state-remnant-foreground">
                        retazo
                      </span>
                    )}
                    {lot.shade && (
                      <span className="tabular text-muted-foreground">tono {lot.shade}</span>
                    )}
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    {lot.location && (
                      <span className="tabular flex items-center gap-0.5 text-muted-foreground">
                        <MapPin className="size-3" aria-hidden />
                        {lot.location}
                      </span>
                    )}
                    <span className="tabular font-medium">
                      {formatQuantity(lot.quantity, { unit: unitLabel })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function StatusDot({ sufficient }: { sufficient: boolean }) {
  if (sufficient) {
    return (
      <span
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-state-available"
        aria-label="Alcanza"
      >
        <Check className="size-3.5 text-state-available-foreground" aria-hidden />
      </span>
    );
  }

  return (
    <span
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-state-defective"
      aria-label="No alcanza"
    >
      <AlertTriangle className="size-3.5 text-state-defective-foreground" aria-hidden />
    </span>
  );
}

const TONE_STYLES: Record<"strong" | "muted" | "danger", string> = {
  strong: "font-semibold",
  muted: "text-muted-foreground",
  danger: "font-semibold text-destructive",
};

function Cell({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "muted" | "danger";
}) {
  const key = tone ?? (strong ? "strong" : "muted");

  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular", TONE_STYLES[key])}>{value}</dd>
    </div>
  );
}
