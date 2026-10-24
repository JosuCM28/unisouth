import type { InventoryDocument, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";
import type { FabricDocument } from "@/lib/order-fabric";

/** Una orden elegible para la salida múltiple, lista para el navegador. */
export interface OrderIssueTarget {
  id: string;
  code: string;
  reference: string | null;
  description: string | null;
  materialId: string | null;
  clientName: string | null;
  materialName: string | null;
}

/**
 * Lectura de la tela que una orden se llevó y la que regresó.
 *
 * Sólo lee: las salidas y devoluciones se crean en DocumentService.
 */
export class OrderFabricRepository extends BaseRepository<
  InventoryDocument,
  Prisma.InventoryDocumentCreateInput,
  Prisma.InventoryDocumentUpdateInput
> {
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.inventoryDocument;
  }

  protected get entityName(): string {
    return "el vale";
  }

  /**
   * Los vales de la orden que llevan ROLLOS, del más nuevo al más viejo.
   *
   * Se filtra por "tiene renglones de rollo" y no por un tipo aparte: la
   * salida de prendas al taller también cuelga de la orden, pero no descuenta
   * tela y no debe aparecer aquí ni sumar al consumo.
   */
  async documentsOfOrder(orderId: string): Promise<FabricDocument[]> {
    const documents = await this.db.inventoryDocument.findMany({
      where: {
        cuttingOrderId: orderId,
        type: { in: ["ISSUE", "PRODUCTION_RETURN"] },
        lines: { some: {} },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        date: true,
        lines: {
          orderBy: { order: "asc" },
          select: {
            lotId: true,
            quantity: true,
            unit: true,
            lot: {
              select: {
                code: true,
                shade: true,
                material: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return documents.map((document) => ({
      id: document.id,
      code: document.code,
      kind: document.type === "ISSUE" ? "ISSUE" : "RETURN",
      status: document.status,
      date: document.date,
      lines: document.lines.map((line) => ({
        lotId: line.lotId,
        lotCode: line.lot.code,
        shade: line.lot.shade,
        materialName: line.lot.material.name,
        unit: line.unit,
        quantity: Number(line.quantity),
      })),
    }));
  }

  /**
   * Las órdenes a las que se les puede sacar tela en la salida múltiple.
   *
   * Fuera las canceladas —ya no corren— y las de la otra planta que nadie ha
   * agregado: todavía no se trabajan aquí, y su tela tampoco.
   */
  async issueTargets(): Promise<OrderIssueTarget[]> {
    const orders = await this.db.cuttingOrder.findMany({
      where: { status: { not: "CANCELLED" }, addedAt: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        reference: true,
        description: true,
        materialId: true,
        client: { select: { name: true } },
        material: { select: { name: true } },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      code: order.code,
      reference: order.reference,
      description: order.description,
      materialId: order.materialId,
      clientName: order.client?.name ?? null,
      materialName: order.material?.name ?? null,
    }));
  }
}
