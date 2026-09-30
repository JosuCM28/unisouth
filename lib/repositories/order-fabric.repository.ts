import type { InventoryDocument, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";
import type { FabricDocument } from "@/lib/order-fabric";

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
}
