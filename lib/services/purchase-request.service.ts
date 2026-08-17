import type { PurchaseRequest, PurchaseRequestStatus } from "@prisma/client";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/lib/core/errors";
import { roleHasPermission } from "@/lib/constants/roles";
import type { PurchaseRequestInput } from "@/lib/validations/purchase-request.schema";
import { BaseService } from "./base.service";

/**
 * Transiciones permitidas del flujo de compra.
 *
 * Se declara el grafo completo en vez de encadenar `if`s: así se lee de un
 * vistazo qué puede pasar después de cada estado, y agregar un paso nuevo es
 * editar este mapa.
 *
 *   DRAFT → SUBMITTED → APPROVED / REJECTED → ORDERED → RECEIVED
 */
const ALLOWED_TRANSITIONS: Record<
  PurchaseRequestStatus,
  PurchaseRequestStatus[]
> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["ORDERED", "CANCELLED"],
  REJECTED: ["DRAFT"],
  ORDERED: ["PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["RECEIVED", "CANCELLED"],
  // Terminales: de aquí no se sale.
  RECEIVED: [],
  CANCELLED: [],
};

const STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  DRAFT: "borrador",
  SUBMITTED: "enviada",
  APPROVED: "autorizada",
  REJECTED: "rechazada",
  ORDERED: "pedida",
  PARTIALLY_RECEIVED: "recibida parcialmente",
  RECEIVED: "recibida",
  CANCELLED: "cancelada",
};

export class PurchaseRequestService extends BaseService {
  async create(input: PurchaseRequestInput): Promise<PurchaseRequest> {
    return this.transaction(async (tx) => {
      const code = await this.sequencesWith(tx).next("PURCHASE_REQUEST", "PR", 4);

      const request = await tx.purchaseRequest.create({
        data: {
          code,
          status: "DRAFT",
          clientId: input.clientId,
          calculationId: input.calculationId,
          neededBy: input.neededByDate,
          justification: input.justification,
          notes: input.notes,
          requestedById: this.context.userId,
          lines: {
            create: input.lines.map((line, index) => ({
              materialId: line.materialId,
              requestedQuantity: line.quantity,
              unit: line.unit,
              notes: line.notes,
              order: index,
            })),
          },
        },
      });

      await this.auditWith(tx).record({
        entity: "PurchaseRequest",
        entityId: request.id,
        action: "CREATE",
        reference: code,
        newValue: { code, lines: input.lines.length },
        sensitivity: "LOW",
      });

      return request;
    });
  }

  /**
   * Crea una requisición con los faltantes de un cálculo.
   *
   * Es el puente entre el motor y compras: el cálculo ya sabe qué falta y
   * cuánto, así que retecleárlo sería pedir errores.
   */
  async createFromCalculation(calculationId: string): Promise<PurchaseRequest> {
    return this.transaction(async (tx) => {
      const calculation = await tx.calculation.findUnique({
        where: { id: calculationId },
        include: {
          requirements: {
            where: { shortage: { gt: 0 } },
            include: { material: { select: { name: true } } },
          },
        },
      });

      if (!calculation) throw new NotFoundError("el cálculo", calculationId);

      if (calculation.requirements.length === 0) {
        throw new BusinessRuleError(
          `El cálculo ${calculation.code} no tiene faltantes: no hay nada que comprar.`,
        );
      }

      return this.create({
        clientId: calculation.clientId ?? undefined,
        calculationId,
        justification: `Faltantes del cálculo ${calculation.code}`,
        notes: undefined,
        neededByDate: undefined,
        lines: calculation.requirements.map((requirement) => ({
          materialId: requirement.materialId,
          quantity: Number(requirement.shortage),
          unit: requirement.unit,
          notes: undefined,
        })),
      });
    });
  }

  /** Manda la requisición a autorización. */
  async submit(id: string): Promise<PurchaseRequest> {
    return this.changeStatus(id, "SUBMITTED", { sensitivity: "MEDIUM" });
  }

  /**
   * Autoriza la compra.
   *
   * Sólo PURCHASING o ADMIN: autorizar es comprometer dinero, y quien
   * levanta la requisición no debe poder aprobársela a sí mismo.
   */
  async approve(id: string, role: string): Promise<PurchaseRequest> {
    this.requireApprovalRights(role);

    return this.changeStatus(id, "APPROVED", {
      sensitivity: "HIGH",
      reason: "Autorización de compra",
      extraData: {
        approvedById: this.context.userId,
        approvedAt: new Date(),
      },
    });
  }

  async reject(id: string, role: string, reason: string): Promise<PurchaseRequest> {
    this.requireApprovalRights(role);

    return this.changeStatus(id, "REJECTED", {
      sensitivity: "HIGH",
      reason,
      extraData: { rejectionReason: reason },
    });
  }

  async markOrdered(id: string): Promise<PurchaseRequest> {
    return this.changeStatus(id, "ORDERED", { sensitivity: "MEDIUM" });
  }

  async markReceived(id: string): Promise<PurchaseRequest> {
    return this.changeStatus(id, "RECEIVED", { sensitivity: "MEDIUM" });
  }

  async cancel(id: string, reason: string): Promise<PurchaseRequest> {
    return this.changeStatus(id, "CANCELLED", {
      sensitivity: "HIGH",
      reason,
    });
  }

  /**
   * Cambia de estado validando la transición contra el grafo.
   *
   * Centralizarlo evita que una pantalla nueva salte pasos: no se puede
   * pasar de borrador a "pedida" sin que alguien la haya autorizado.
   */
  private async changeStatus(
    id: string,
    next: PurchaseRequestStatus,
    options: {
      sensitivity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      reason?: string;
      extraData?: Record<string, unknown>;
    },
  ): Promise<PurchaseRequest> {
    return this.transaction(async (tx) => {
      const current = await tx.purchaseRequest.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("la requisición", id);

      if (!ALLOWED_TRANSITIONS[current.status].includes(next)) {
        throw new BusinessRuleError(
          `La requisición ${current.code} está ${STATUS_LABELS[current.status]} y no puede pasar a ${STATUS_LABELS[next]}.`,
        );
      }

      const updated = await tx.purchaseRequest.update({
        where: { id },
        data: { status: next, ...options.extraData },
      });

      await this.auditWith(tx).record({
        entity: "PurchaseRequest",
        entityId: id,
        action: next === "APPROVED" ? "APPROVE" : "UPDATE",
        reference: current.code,
        oldValue: { status: current.status },
        newValue: { status: next },
        sensitivity: options.sensitivity,
        reason: options.reason,
      });

      return updated;
    });
  }

  private requireApprovalRights(role: string): void {
    if (!roleHasPermission(role, "purchase:approve")) {
      throw new ForbiddenError(
        "Sólo Compras o un administrador pueden autorizar una requisición.",
      );
    }
  }
}
