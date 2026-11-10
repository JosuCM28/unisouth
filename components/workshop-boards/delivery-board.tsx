import { Factory } from "lucide-react";
import type { Role } from "@/lib/constants/roles";
import {
  BOARD_KEY_BY_ROLE,
  type WorkshopBoardTab,
  type WorkshopRole,
} from "@/lib/constants/workshop-access";
import { listReportMonths } from "@/lib/report-period";
import { todayInputValue } from "@/lib/utils";
import {
  WorkshopDeliveryService,
  type WorkshopDeliveryList,
} from "@/lib/services/workshop-delivery.service";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DeliveryBoardBody } from "./delivery-board-body";

export interface DeliveryBoardProps {
  title: string;
  /** De qué taller es este tablero. */
  boardRole: WorkshopRole;
  /** Quién lo mira: ADMIN lo ve, pero confirmar le toca al taller. */
  viewerRole: Role;
  tab: WorkshopBoardTab;
  basePath: string;
}

export async function DeliveryBoard(props: DeliveryBoardProps) {
  const list = await new WorkshopDeliveryService().listForRole(props.boardRole);
  return <DeliveryBoardView {...props} list={list} />;
}

/** Sin consultas: recibe las entregas ya leídas. */
export function DeliveryBoardView({
  title,
  boardRole,
  viewerRole,
  tab,
  basePath,
  list,
}: DeliveryBoardProps & { list: WorkshopDeliveryList | null }) {
  if (!list) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={title} description="Sin taller ligado" />
        <div className="flat-surface">
          <EmptyState
            icon={Factory}
            title="Este tablero aún no está ligado a un taller"
            description="Se liga en el catálogo de Talleres, en Cuenta de acceso."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} description={list.workshopName} />
      <DeliveryBoardBody
        rows={list.rows}
        tab={tab}
        basePath={basePath}
        // El detalle pide la llave del taller: a ADMIN lo mandaría a un error.
        isOwner={viewerRole === boardRole}
        report={{
          boardKey: BOARD_KEY_BY_ROLE[boardRole],
          months: listReportMonths(),
          today: todayInputValue(),
        }}
      />
    </div>
  );
}
