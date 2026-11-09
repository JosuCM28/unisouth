import type { Role } from "@/lib/constants/roles";
import type { WorkshopBoardTab } from "@/lib/constants/workshop-access";
import { DeliveryBoard } from "./delivery-board";

/** El tablero de Broderie. Componente propio: puede crecer aparte del resto. */
export function BroderieBoard({
  viewerRole,
  tab,
}: {
  viewerRole: Role;
  tab: WorkshopBoardTab;
}) {
  return (
    <DeliveryBoard
      title="Tablero Broderie"
      boardRole="WORKSHOP_BRODERIE"
      basePath="/workshop-boards/broderie"
      viewerRole={viewerRole}
      tab={tab}
    />
  );
}
