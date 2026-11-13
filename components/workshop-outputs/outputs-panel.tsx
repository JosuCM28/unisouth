"use client";

import { PackageOpen, SearchX } from "lucide-react";
import type { WorkshopOutputRow } from "@/lib/repositories/workshop-output.repository";
import type { WorkshopBalanceOrder } from "@/lib/services/workshop-output.service";
import { EmptyState } from "@/components/shared/empty-state";
import { OutputCancelButton } from "./output-cancel-button";
import { OutputCard } from "./output-card";
import { OutputFormDialog } from "./output-form-dialog";

/** Lo que el tablero de un taller de proceso trae para su pestaña Salidas. */
export interface OutputsBoardData {
  rows: WorkshopOutputRow[];
  /** Vacío para quien sólo mira: ADMIN no captura salidas. */
  balance: WorkshopBalanceOrder[];
  destinations: { id: string; name: string }[];
}

/**
 * La pestaña Salidas: lo que el taller ya sacó y, para el dueño, el botón de
 * capturar otra. El buscador del tablero también filtra aquí.
 */
export function OutputsPanel({
  data,
  isOwner,
  query,
}: {
  data: OutputsBoardData;
  isOwner: boolean;
  query: string;
}) {
  const rows = filterOutputs(data.rows, query);

  return (
    <div className="flex flex-col gap-3">
      {isOwner && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {data.balance.length === 0
              ? "No tienes piezas recibidas pendientes de salir."
              : `Tienes piezas de ${data.balance.length} ${data.balance.length === 1 ? "orden" : "órdenes"}.`}
          </p>
          <OutputFormDialog balance={data.balance} destinations={data.destinations} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flat-surface">
          <EmptyState
            icon={query.trim() ? SearchX : PackageOpen}
            title={query.trim() ? `Ninguna salida coincide con “${query.trim()}”` : "Todavía no hay salidas."}
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((output) => (
            <OutputCard
              key={output.id}
              output={output}
              showOrder
              action={isOwner ? <OutputCancelButton id={output.id} code={output.code} /> : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Mismo criterio que el buscador de entregas: folio, orden, cliente, prenda. */
function filterOutputs(rows: WorkshopOutputRow[], query: string): WorkshopOutputRow[] {
  const term = query.trim().toLowerCase();
  if (!term) return rows;

  return rows.filter((row) =>
    [row.code, row.order.code, row.order.reference, row.order.client?.name, row.order.description,
      row.destinationWorkshop?.name, row.parts]
      .some((value) => value?.toLowerCase().includes(term)),
  );
}

/** Cuántas cuenta la pestaña: las vigentes. */
export function activeOutputCount(data: OutputsBoardData): number {
  return data.rows.filter((row) => row.cancelledAt === null).length;
}
