import type { InventoryDocument, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";
import {
  VOUCHER_SHEET_INCLUDE,
  type VoucherDocument,
} from "@/lib/vouchers/voucher-sheet";

/**
 * Lectura del vale COMPLETO, tal como se imprime.
 *
 * Sólo lee: los vales se crean, aplican y cancelan en DocumentService. Aparte
 * de él porque aquí la pregunta no es "cómo cambia el documento" sino "qué
 * dice la hoja", y la contestan igual la página de impresión y el PDF de
 * WhatsApp.
 */
export class VoucherRepository extends BaseRepository<
  InventoryDocument,
  Prisma.InventoryDocumentCreateInput,
  Prisma.InventoryDocumentUpdateInput
> {
  // Los vales no se dan de baja: se cancelan y siguen existiendo.
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.inventoryDocument;
  }

  protected get entityName(): string {
    return "el vale";
  }

  /** El vale con todo lo que su hoja necesita, o null si no existe. */
  async findSheetDocument(id: string): Promise<VoucherDocument | null> {
    return this.db.inventoryDocument.findUnique({
      where: { id },
      include: VOUCHER_SHEET_INCLUDE,
    });
  }
}
