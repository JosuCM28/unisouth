import type { CutEditRequest, Prisma } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

const LIST_INCLUDE = {
  order: { select: { id: true, code: true, description: true, status: true } },
  requestedBy: { select: { name: true } },
  reviewedBy: { select: { name: true } },
} satisfies Prisma.CutEditRequestInclude;

export type CutEditRequestRow = Prisma.CutEditRequestGetPayload<{
  include: typeof LIST_INCLUDE;
}>;

/** Cuántas resueltas se enseñan debajo de las pendientes. */
const RECENT_LIMIT = 30;

export class CutEditRequestRepository extends BaseRepository<
  CutEditRequest,
  Prisma.CutEditRequestCreateInput,
  Prisma.CutEditRequestUpdateInput
> {
  /* Nunca se borran: son el rastro de quién pidió abrir qué y quién lo
     autorizó. */
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.cutEditRequest;
  }

  protected get entityName(): string {
    return "la solicitud";
  }

  /** Las que esperan respuesta, la más vieja primero: es la que más lleva esperando. */
  async findPending(): Promise<CutEditRequestRow[]> {
    return this.db.cutEditRequest.findMany({
      where: { status: "PENDING" },
      include: LIST_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
  }

  /** Las ya resueltas, la más reciente primero. */
  async findRecentResolved(): Promise<CutEditRequestRow[]> {
    return this.db.cutEditRequest.findMany({
      where: { status: { not: "PENDING" } },
      include: LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
    });
  }

  /**
   * La última solicitud VIVA de esta persona sobre esta orden: pendiente, o
   * autorizada y sin vencer. Es lo que la ficha de la orden necesita para
   * decidir entre "Solicitar edición", "Esperando autorización" y dejar
   * capturar.
   */
  async findLiveFor(orderId: string, userId: string, now = new Date()) {
    return this.db.cutEditRequest.findFirst({
      where: {
        orderId,
        requestedById: userId,
        OR: [
          { status: "PENDING" },
          { status: "APPROVED", expiresAt: { gt: now } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, expiresAt: true },
    });
  }
}
