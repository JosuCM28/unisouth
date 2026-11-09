import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

/** El tablero de Allende. Componente propio: se va a diseñar aparte del resto. */
export function AllendeBoard() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Tablero Allende" description="Taller Allende" />
      <div className="flat-surface">
        <EmptyState
          icon={LayoutDashboard}
          title="Este tablero está en preparación"
          description="Tus entregas están en Órdenes."
        />
      </div>
    </div>
  );
}
