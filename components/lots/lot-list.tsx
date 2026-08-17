import { Boxes } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LotCard, type LotCardData } from "./lot-card";
import { LotTable } from "./lot-table";

interface LotListProps {
  lots: LotCardData[];
  total: number;
  isFiltered?: boolean;
}

export function LotList({ lots, total, isFiltered }: LotListProps) {
  if (lots.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={Boxes}
          title={isFiltered ? "Sin resultados" : "Aún no hay rollos"}
          description={
            isFiltered
              ? "Prueba con otro folio, material o quita algún filtro."
              : "Da de alta el primer rollo con el botón de arriba."
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="tabular text-xs text-muted-foreground">
        {total} {total === 1 ? "rollo" : "rollos"}
      </p>

      {/* Celular: tarjetas apiladas. Una tabla obligaría a barrer de lado
          para leer una sola fila, con el teléfono en una mano. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {lots.map((lot) => (
          <li key={lot.id}>
            <LotCard lot={lot} />
          </li>
        ))}
      </ul>

      <LotTable lots={lots} />
    </div>
  );
}
