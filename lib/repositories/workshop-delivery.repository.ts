import type { GarmentShipment, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

/**
 * Tope de la lista. Sobra para el trabajo vivo de un taller, y evita bajarse
 * años de envíos con datos móviles.
 */
export const WORKSHOP_DELIVERY_LIMIT = 300;

const LIST_SELECT = {
  id: true,
  code: true,
  status: true,
  sentAt: true,
  parts: true,
  receivedAt: true,
  stage: { select: { name: true } },
  document: { select: { status: true } },
  order: {
    select: {
      code: true,
      reference: true,
      description: true,
      client: { select: { name: true } },
    },
  },
  lines: { select: { sentQuantity: true, bundles: true } },
} satisfies Prisma.GarmentShipmentSelect;

export type WorkshopDeliveryListRow = Prisma.GarmentShipmentGetPayload<{
  select: typeof LIST_SELECT;
}>;

/**
 * Lo que el taller puede leer de la orden.
 *
 * Enumerado campo por campo y no con `include`: los comentarios internos, los
 * adjuntos y los demás envíos de la orden NO salen de la casa, y una lista
 * explícita hace que un campo nuevo no se cuele solo.
 */
const DETAIL_SELECT = {
  id: true,
  code: true,
  status: true,
  sentAt: true,
  parts: true,
  notes: true,
  reference: true,
  receivedAt: true,
  documentId: true,
  receivedBy: { select: { name: true } },
  stage: { select: { name: true } },
  document: { select: { status: true, code: true } },
  lines: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      sentQuantity: true,
      bundles: true,
      notes: true,
      size: { select: { code: true } },
      cutTag: { select: { name: true, color: true } },
    },
  },
  order: {
    select: {
      code: true,
      reference: true,
      clientPo: true,
      description: true,
      dueDate: true,
      notes: true,
      cutFabricText: true,
      cutPattern: true,
      cutVersion: true,
      cutVersionNotes: true,
      cutNotes: true,
      client: { select: { name: true } },
      material: { select: { code: true, name: true } },
      batches: {
        orderBy: { number: "desc" },
        select: {
          id: true,
          number: true,
          label: true,
          notes: true,
          openedAt: true,
          groupId: true,
        },
      },
      lines: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          sizeId: true,
          notes: true,
          size: { select: { code: true } },
          cutTag: { select: { name: true, color: true } },
          progress: {
            select: {
              id: true,
              batchId: true,
              quantity: true,
              bundles: true,
              tagId: true,
              notes: true,
              createdAt: true,
              cutTag: { select: { name: true, color: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.GarmentShipmentSelect;

export type WorkshopDeliveryDetailRow = Prisma.GarmentShipmentGetPayload<{
  select: typeof DETAIL_SELECT;
}>;

/** A quién le pertenece una entrega, para decidir si se le enseña. */
export interface WorkshopScope {
  id: string;
  accessSince: Date | null;
}

/**
 * Las entregas de UN taller. Todas las lecturas exigen el taller: no existe
 * forma de pedir una entrega sin decir de quién es.
 */
export class WorkshopDeliveryRepository extends BaseRepository<
  GarmentShipment,
  Prisma.GarmentShipmentCreateInput,
  Prisma.GarmentShipmentUpdateInput
> {
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.garmentShipment;
  }

  protected get entityName(): string {
    return "la entrega";
  }

  async findWorkshopByRole(role: string) {
    return this.db.workshop.findFirst({
      where: { accessRole: role, deletedAt: null },
      select: { id: true, name: true, accessSince: true },
    });
  }

  async findList(scope: WorkshopScope): Promise<WorkshopDeliveryListRow[]> {
    return this.db.garmentShipment.findMany({
      where: scopeWhere(scope),
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: WORKSHOP_DELIVERY_LIMIT,
      select: LIST_SELECT,
    });
  }

  async findDetail(
    scope: WorkshopScope,
    id: string,
  ): Promise<WorkshopDeliveryDetailRow | null> {
    return this.db.garmentShipment.findFirst({
      where: { id, ...scopeWhere(scope) },
      select: DETAIL_SELECT,
    });
  }

  /** El vale sólo si es de una entrega de este taller. */
  async findByDocument(scope: WorkshopScope, documentId: string) {
    return this.db.garmentShipment.findFirst({
      where: { documentId, ...scopeWhere(scope) },
      select: {
        status: true,
        receivedAt: true,
        document: { select: { status: true } },
      },
    });
  }
}

function scopeWhere(scope: WorkshopScope): Prisma.GarmentShipmentWhereInput {
  return {
    workshopId: scope.id,
    // Sólo lo enviado desde que el taller tiene cuenta.
    createdAt: scope.accessSince ? { gte: scope.accessSince } : undefined,
  };
}
