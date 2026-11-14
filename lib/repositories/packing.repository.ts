import type { PackingOrder, Prisma } from "@prisma/client";
import { BaseRepository, type PrismaDelegate } from "@/lib/core/base-repository";

/** Un renglón dentro de una caja, con lo que el packing list imprime. */
const BOX_LINE_SELECT = {
  id: true,
  quantity: true,
  stock: {
    select: {
      id: true,
      clientPo: true,
      product: {
        select: { id: true, name: true, code: true, garmentCategory: { select: { name: true, position: true } } },
      },
      size: { select: { id: true, code: true, order: true } },
    },
  },
} satisfies Prisma.PackingBoxLineSelect;

export type PackingBoxLineRow = Prisma.PackingBoxLineGetPayload<{ select: typeof BOX_LINE_SELECT }>;

const ORDER_HEADER_SELECT = {
  id: true,
  code: true,
  name: true,
  status: true,
  date: true,
  notes: true,
  closedAt: true,
  clientId: true,
  client: { select: { id: true, name: true } },
} satisfies Prisma.PackingOrderSelect;

const ORDER_DETAIL_SELECT = {
  ...ORDER_HEADER_SELECT,
  boxes: {
    orderBy: { number: "asc" },
    select: { id: true, number: true, lines: { select: BOX_LINE_SELECT } },
  },
} satisfies Prisma.PackingOrderSelect;

export type PackingOrderDetail = Prisma.PackingOrderGetPayload<{ select: typeof ORDER_DETAIL_SELECT }>;
export type PackingBoxRow = PackingOrderDetail["boxes"][number];

export interface PackingOrderListItem {
  id: string;
  code: string;
  name: string;
  status: PackingOrder["status"];
  date: Date;
  clientName: string | null;
  boxes: number;
  pieces: number;
}

/** Lectura de los pedidos de empaque. Las reglas viven en PackingService. */
export class PackingRepository extends BaseRepository<
  PackingOrder,
  Prisma.PackingOrderCreateInput,
  Prisma.PackingOrderUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.packingOrder;
  }

  protected get entityName(): string {
    return "el pedido de empaque";
  }

  /** Abiertos primero (son los que se trabajan), luego lo más reciente. */
  async findList(): Promise<PackingOrderListItem[]> {
    const orders = await this.db.packingOrder.findMany({
      orderBy: [{ status: "asc" }, { date: "desc" }],
      take: 200,
      select: {
        id: true, code: true, name: true, status: true, date: true,
        client: { select: { name: true } },
        boxes: { select: { lines: { select: { quantity: true } } } },
      },
    });

    return orders.map(({ client, boxes, ...order }) => ({
      ...order,
      clientName: client?.name ?? null,
      boxes: boxes.length,
      pieces: boxes.reduce((sum, box) => sum + box.lines.reduce((acc, line) => acc + line.quantity, 0), 0),
    }));
  }

  async findDetail(id: string): Promise<PackingOrderDetail | null> {
    return this.db.packingOrder.findUnique({ where: { id }, select: ORDER_DETAIL_SELECT });
  }

  /** Una caja por su número dentro del pedido, con el encabezado del pedido. */
  async findBox(orderId: string, number: number) {
    return this.db.packingBox.findUnique({
      where: { orderId_number: { orderId, number } },
      select: {
        id: true,
        number: true,
        order: { select: ORDER_HEADER_SELECT },
        lines: { select: BOX_LINE_SELECT },
      },
    });
  }

  /** Cuántas cajas tiene el pedido, para saber si existe la siguiente. */
  async countBoxes(orderId: string): Promise<number> {
    return this.db.packingBox.count({ where: { orderId } });
  }
}
