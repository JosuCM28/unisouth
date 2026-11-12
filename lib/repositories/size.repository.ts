import type { Prisma, Size } from "@prisma/client";
import { BaseRepository, type PrismaDelegate } from "@/lib/core/base-repository";

export interface SizeOption {
  id: string;
  code: string;
  name: string;
}

export class SizeRepository extends BaseRepository<
  Size,
  Prisma.SizeCreateInput,
  Prisma.SizeUpdateInput
> {
  // Las tallas se desactivan, no se borran: no tienen `deletedAt`.
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.size;
  }

  protected get entityName(): string {
    return "la talla";
  }

  /** Tallas vigentes en el orden de la escala (CH, M, G…), no alfabético. */
  async findOptions(): Promise<SizeOption[]> {
    return this.db.size.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true },
      orderBy: { order: "asc" },
    });
  }
}
