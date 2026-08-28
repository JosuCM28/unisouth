import type { Metadata } from "next";
import { MovementRepository } from "@/lib/repositories/movement.repository";
import { requirePermission } from "@/lib/core/session";
import {
  parseMovementFilters,
  type MovementSearchParams,
} from "@/lib/export/movement-filters";
import {
  MOVEMENT_DIRECTION_LABELS,
  MOVEMENT_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { formatDate, formatQuantity } from "@/lib/utils";
import { PrintSheet, PrintTable } from "@/components/shared/print-sheet";
import type { MovementDirection, MovementType, Unit } from "@prisma/client";

export const metadata: Metadata = { title: "Kárdex impreso" };

interface PageProps {
  searchParams: Promise<MovementSearchParams>;
}

/** El kárdex filtrado, en papel o PDF. La contraparte del Excel. */
export default async function PrintMovementsPage({ searchParams }: PageProps) {
  await requirePermission("inventory:browse");

  const params = await searchParams;
  const movements = await new MovementRepository().findAllForExport(
    parseMovementFilters(params),
  );

  const rows = movements.map((movement) => [
    movement.code,
    formatDate(movement.createdAt),
    MOVEMENT_TYPE_LABELS[movement.type],
    movement.lot.code,
    movement.material.name,
    formatQuantity(movement.quantity, {
      unit: UNIT_SHORT_LABELS[movement.unit as Unit],
    }),
    formatQuantity(movement.balanceAfter),
    movement.document?.code ?? "—",
    movement.userName ?? "—",
  ]);

  const criteria: string[] = [];
  if (params.direction) {
    criteria.push(
      MOVEMENT_DIRECTION_LABELS[params.direction as MovementDirection] ??
        params.direction,
    );
  }
  if (params.type) {
    criteria.push(
      MOVEMENT_TYPE_LABELS[params.type as MovementType] ?? params.type,
    );
  }
  if (params.materialId) criteria.push("un material");
  if (params.from) criteria.push(`desde ${params.from}`);
  if (params.to) criteria.push(`hasta ${params.to}`);

  return (
    <PrintSheet
      title="Kárdex de movimientos"
      criteria={criteria.length > 0 ? criteria : ["sin filtro"]}
      count={`${movements.length} ${movements.length === 1 ? "movimiento" : "movimientos"}`}
    >
      <PrintTable
        head={[
          "Folio",
          "Fecha",
          "Tipo",
          "Rollo",
          "Material",
          "Cantidad",
          "Saldo",
          "Documento",
          "Capturó",
        ]}
        rows={rows}
        numeric={[5, 6]}
        empty="Ningún movimiento cumple con ese filtro."
      />
    </PrintSheet>
  );
}
