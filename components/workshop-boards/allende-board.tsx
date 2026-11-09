import type { Role } from "@/lib/constants/roles";
import type { WorkshopBoardTab } from "@/lib/constants/workshop-access";
import { DeliveryBoard } from "./delivery-board";

/** El tablero de Allende. Componente propio: puede crecer aparte del resto. */
export function AllendeBoard({
  viewerRole,
  tab,
}: {
  viewerRole: Role;
  tab: WorkshopBoardTab;
}) {
  return (
    <DeliveryBoard
      title="Tablero Allende"
      boardRole="WORKSHOP_ALLENDE"
      basePath="/workshop-boards/allende"
      viewerRole={viewerRole}
      tab={tab}
    />
  );
}
