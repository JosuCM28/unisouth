import type { PackingListSheet, Prisma } from "@prisma/client";
import { BaseRepository, type PrismaDelegate } from "@/lib/core/base-repository";

const SHEET_SELECT = {
  id: true,
  orderId: true,
  formatCode: true,
  revision: true,
  client: true,
  date: true,
  preparedBy: true,
  reviewedBy: true,
  receivedBy: true,
  notes: true,
  updatedAt: true,
  updatedBy: { select: { name: true } },
  lines: {
    orderBy: { position: "asc" },
    select: {
      stockId: true,
      orderRef: true,
      destination: true,
      description: true,
      color: true,
      boxNumber: true,
      size: true,
      quantity: true,
    },
  },
  boxes: {
    orderBy: { boxNumber: "asc" },
    select: { boxNumber: true, weightKg: true, dimensions: true },
  },
} satisfies Prisma.PackingListSheetSelect;

export type PackingListSheetRow = Prisma.PackingListSheetGetPayload<{ select: typeof SHEET_SELECT }>;

/** Lectura del packing list editado. Guardarlo es de PackingListSheetService. */
export class PackingListSheetRepository extends BaseRepository<
  PackingListSheet,
  Prisma.PackingListSheetCreateInput,
  Prisma.PackingListSheetUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.packingListSheet;
  }

  protected get entityName(): string {
    return "el packing list";
  }

  async findByOrder(orderId: string): Promise<PackingListSheetRow | null> {
    return this.db.packingListSheet.findUnique({ where: { orderId }, select: SHEET_SELECT });
  }
}
