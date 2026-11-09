import type { Role } from "@/lib/constants/roles";
import type { WorkshopBoardTab } from "@/lib/constants/workshop-access";
import { DeliveryBoard } from "./delivery-board";

/** El tablero de Sitex. Componente propio: puede crecer aparte del resto. */
export function SitexBoard({
  viewerRole,
  tab,
}: {
  viewerRole: Role;
  tab: WorkshopBoardTab;
}) {
  return (
    <DeliveryBoard
      title="Tablero Sitex"
      boardRole="WORKSHOP_SITEX"
      basePath="/workshop-boards/sitex"
      viewerRole={viewerRole}
      tab={tab}
    />
  );
}
