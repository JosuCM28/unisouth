import type { Role } from "@/lib/constants/roles";
import type { WorkshopBoardTab } from "@/lib/constants/workshop-access";
import { DeliveryBoard } from "./delivery-board";

/** El tablero de Acatlán. Componente propio: puede crecer aparte del resto. */
export function AcatlanBoard({
  viewerRole,
  tab,
}: {
  viewerRole: Role;
  tab: WorkshopBoardTab;
}) {
  return (
    <DeliveryBoard
      title="Tablero Acatlán"
      boardRole="WORKSHOP_ACATLAN"
      basePath="/workshop-boards/acatlan"
      viewerRole={viewerRole}
      tab={tab}
    />
  );
}
