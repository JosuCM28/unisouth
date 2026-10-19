import type { CuttingOrderStatus } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import { roleHasPermission } from "@/lib/constants/roles";
import type {
  CutEditRequestInput,
  CutEditReviewInput,
} from "@/lib/validations/cut-edit-request.schema";
import { BaseService } from "./base.service";

/**
 * Cuánto vive un permiso autorizado que nadie ha usado.
 *
 * Un día: lo normal es que quien lo pidió esté esperando en la mesa. Si no lo
 * usa hoy, mañana vuelve a pedirlo y ADMIN vuelve a ver el motivo.
 */
const GRANT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * El candado de las órdenes terminadas y los permisos para abrirlo.
 *
 * Mientras la orden va "Abierta" o "En corte" se captura libre: es trabajo
 * vivo y el foleador corrige sobre la marcha. En cuanto queda "Terminada", lo
 * capturado es lo que se firma y se manda a taller; desde ahí, cambiarlo pide
 * motivo y autorización de ADMIN, y cada autorización sirve para UN guardado.
 */
export class CutEditRequestService extends BaseService {
  async request(input: CutEditRequestInput) {
    const userId = this.requireUser();

    return this.transaction(async (tx) => {
      const order = await tx.cuttingOrder.findUnique({
        where: { id: input.orderId },
        select: { id: true, code: true, status: true },
      });
      if (!order) throw new NotFoundError("la orden", input.orderId);

      if (order.status !== "COMPLETED") {
        throw new BusinessRuleError(
          `La orden ${order.code} no está terminada: sus cortes se pueden capturar sin pedir permiso.`,
        );
      }

      /* Una sola viva por persona y orden: dos pendientes iguales sólo
         obligan a ADMIN a contestar dos veces lo mismo. */
      const live = await tx.cutEditRequest.findFirst({
        where: {
          orderId: order.id,
          requestedById: userId,
          OR: [
            { status: "PENDING" },
            { status: "APPROVED", expiresAt: { gt: new Date() } },
          ],
        },
        select: { status: true },
      });
      if (live) {
        throw new BusinessRuleError(
          live.status === "PENDING"
            ? "Ya tienes una solicitud pendiente para esta orden."
            : "Ya tienes una autorización vigente para esta orden.",
        );
      }

      const created = await tx.cutEditRequest.create({
        data: { orderId: order.id, requestedById: userId, reason: input.reason },
      });

      await this.auditWith(tx).record({
        entity: "CutEditRequest",
        entityId: created.id,
        action: "CREATE",
        reference: order.code,
        newValue: { solicitud: "Editar cortes de orden terminada" },
        sensitivity: "MEDIUM",
        reason: input.reason,
      });

      return created;
    });
  }

  async review(input: CutEditReviewInput) {
    const userId = this.requireUser();

    return this.transaction(async (tx) => {
      const request = await tx.cutEditRequest.findUnique({
        where: { id: input.id },
        include: { order: { select: { code: true } } },
      });
      if (!request) throw new NotFoundError("la solicitud", input.id);

      if (request.status !== "PENDING") {
        throw new BusinessRuleError("Esta solicitud ya fue contestada.");
      }

      const now = new Date();
      const updated = await tx.cutEditRequest.update({
        where: { id: request.id },
        data: {
          status: input.approve ? "APPROVED" : "REJECTED",
          reviewedById: userId,
          reviewedAt: now,
          reviewNote: input.note,
          expiresAt: input.approve
            ? new Date(now.getTime() + GRANT_TTL_MS)
            : null,
        },
      });

      /* HIGH: abrir un corte terminado es de lo que hay que poder rendir
         cuentas. El motivo de la bitácora es el de quien lo pidió si ADMIN
         no escribió nota, porque ése es el porqué de la edición. */
      await this.auditWith(tx).record({
        entity: "CutEditRequest",
        entityId: request.id,
        action: input.approve ? "APPROVE" : "UPDATE",
        reference: request.order.code,
        oldValue: { estado: request.status },
        newValue: { estado: updated.status },
        sensitivity: "HIGH",
        reason: input.note ?? request.reason,
      });

      return updated;
    });
  }

  /**
   * Deja pasar una captura sobre la orden, o la rebota.
   *
   * Lo llama `CuttingOrderService` DENTRO de su transacción, antes de tocar
   * una sola pieza. Si la orden está terminada y quien captura no es ADMIN,
   * se gasta su autorización en este mismo guardado: con `updateMany`
   * condicionado a `APPROVED`, dos guardados simultáneos no pueden usar el
   * mismo permiso, porque sólo uno encuentra la fila todavía autorizada.
   *
   * Sin usuario en el contexto (seed, scripts) no hay a quién pedirle
   * permiso: lo que corre desde la terminal ya lo decidió quien la abrió.
   */
  async assertCanCapture(
    tx: PrismaExecutor,
    order: { id: string; code: string; status: CuttingOrderStatus },
  ) {
    if (order.status !== "COMPLETED") return;

    const userId = this.context.userId;
    if (!userId) return;

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (roleHasPermission(user?.role, "cuts:unlock")) return;

    const now = new Date();
    const grant = await tx.cutEditRequest.findFirst({
      where: {
        orderId: order.id,
        requestedById: userId,
        status: "APPROVED",
        expiresAt: { gt: now },
      },
      orderBy: { reviewedAt: "desc" },
      select: { id: true },
    });

    const used = grant
      ? await tx.cutEditRequest.updateMany({
          where: { id: grant.id, status: "APPROVED" },
          data: { status: "USED", usedAt: now },
        })
      : { count: 0 };

    if (used.count === 0) {
      throw new BusinessRuleError(
        `La orden ${order.code} está terminada. Solicita autorización para editar sus cortes.`,
      );
    }
  }

  private requireUser(): string {
    if (!this.context.userId) {
      throw new BusinessRuleError("Inicia sesión para continuar.");
    }
    return this.context.userId;
  }
}
