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
import { WorkshopOutputService } from "@/lib/services/workshop-output.service";
import { roleHasPermission } from "@/lib/constants/roles";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { FinishedGoodsRepository } from "@/lib/repositories/finished-goods.repository";
import { GarmentCategoryRepository } from "@/lib/repositories/garment-category.repository";
import type { OutputsBoardData } from "@/components/workshop-outputs/outputs-panel";
import type { FinishedOutputOptions } from "@/components/workshop-outputs/finished-output-dialog";
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
  const [list, outputs] = await Promise.all([
    new WorkshopDeliveryService().listForRole(props.boardRole),
    loadOutputs(props.boardRole, props.viewerRole === props.boardRole),
  ]);
  return <DeliveryBoardView {...props} list={list} outputs={outputs} />;
}

/**
 * La pestaña Salidas: piezas a otro taller si es de PROCESO, prenda
 * terminada a Embarques si es de CONFECCIÓN. El saldo y los catálogos sólo
 * se leen para el dueño, que es el único que captura.
 */
async function loadOutputs(boardRole: WorkshopRole, isOwner: boolean): Promise<OutputsBoardData | null> {
  const service = new WorkshopOutputService();
  const workshop = await service.findWorkshopByRole(boardRole);
  if (!workshop) return null;

  const isAssembly = workshop.kind === "ASSEMBLY";
  const [rows, balance, destinations, finishedOptions] = await Promise.all([
    service.listFor(workshop.id),
    isOwner ? service.balanceFor(workshop.id) : Promise.resolve([]),
    isOwner && !isAssembly ? service.destinationsFor(workshop.id) : Promise.resolve([]),
    isOwner && isAssembly ? loadFinishedOptions(boardRole) : Promise.resolve(null),
  ]);
  return { kind: workshop.kind, rows, balance, destinations, finishedOptions };
}

async function loadFinishedOptions(role: WorkshopRole): Promise<FinishedOutputOptions> {
  const [products, categories, clients] = await Promise.all([
    new FinishedGoodsRepository().findProductOptions(),
    new GarmentCategoryRepository().findOptions(),
    new ClientRepository().findOptions(),
  ]);
  return {
    products: products.map(({ garmentCategory, ...product }) => ({
      ...product, category: garmentCategory?.name ?? null,
    })),
    categories,
    clients,
    canCreateProduct: roleHasPermission(role, "products:create"),
  };
}

/** Sin consultas: recibe las entregas ya leídas. */
export function DeliveryBoardView({
  title,
  boardRole,
  viewerRole,
  tab,
  basePath,
  list,
  outputs = null,
}: DeliveryBoardProps & {
  list: WorkshopDeliveryList | null;
  outputs?: OutputsBoardData | null;
}) {
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
        outputs={outputs}
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
