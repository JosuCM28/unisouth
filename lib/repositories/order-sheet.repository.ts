import type { CuttingOrder, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";
import { ORDER_SHEET_INCLUDE, type SheetOrder } from "@/lib/orders/order-sheet";

/**
 * Lectura de la orden COMPLETA, tal como se imprime.
 *
 * Sólo lee. Aparte de las demás lecturas de órdenes porque aquí la pregunta
 * es "qué dice la hoja", y la contestan igual la página de impresión y el PDF
 * que abre el taller en el celular.
 */
export class OrderSheetRepository extends BaseRepository<
  CuttingOrder,
  Prisma.CuttingOrderCreateInput,
  Prisma.CuttingOrderUpdateInput
> {
  // Las órdenes se cancelan y siguen existiendo: no hay baja lógica.
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.cuttingOrder;
  }

  protected get entityName(): string {
    return "la orden";
  }

  /** La orden con todo lo que su hoja necesita, o null si no existe. */
  async findSheetOrder(id: string): Promise<SheetOrder | null> {
    return this.db.cuttingOrder.findUnique({
      where: { id },
      include: ORDER_SHEET_INCLUDE,
    });
  }
}
