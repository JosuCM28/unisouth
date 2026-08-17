import type { Material } from "@prisma/client";
import { STATUSES_CONSUMED } from "@/lib/constants/lot-status";
import { BusinessRuleError, DuplicateError } from "@/lib/core/errors";
import { MaterialRepository } from "@/lib/repositories/material.repository";
import type { MaterialInput } from "@/lib/validations/material.schema";
import { BaseService } from "./base.service";

export class MaterialService extends BaseService {
  async create(input: MaterialInput): Promise<Material> {
    return this.transaction(async (tx) => {
      const repository = new MaterialRepository(tx);

      if (await repository.codeExists(input.code)) {
        throw new DuplicateError("el material", "código", input.code, "code");
      }

      const material = await repository.create(this.toData(input));

      await this.auditWith(tx).record({
        entity: "Material",
        entityId: material.id,
        action: "CREATE",
        reference: material.code,
        newValue: material,
        sensitivity: "LOW",
      });

      return material;
    });
  }

  async update(id: string, input: MaterialInput): Promise<Material> {
    return this.transaction(async (tx) => {
      const repository = new MaterialRepository(tx);
      const before = await repository.findByIdOrThrow(id);

      if (await repository.codeExists(input.code, id)) {
        throw new DuplicateError("el material", "código", input.code, "code");
      }

      const material = await repository.update(id, this.toData(input));

      await this.auditWith(tx).record({
        entity: "Material",
        entityId: material.id,
        action: "UPDATE",
        reference: material.code,
        oldValue: before,
        newValue: material,
        sensitivity: "MEDIUM",
      });

      return material;
    });
  }

  /**
   * Baja lógica.
   *
   * Se niega si todavía hay rollos con existencia: el material seguiría
   * físicamente en la bodega pero desaparecería de los catálogos, y nadie
   * podría surtirlo ni darle salida.
   */
  async remove(id: string, reason?: string): Promise<Material> {
    return this.transaction(async (tx) => {
      const repository = new MaterialRepository(tx);
      const before = await repository.findByIdOrThrow(id);

      const lotsWithStock = await tx.lot.count({
        where: {
          materialId: id,
          currentQuantity: { gt: 0 },
          status: { notIn: [...STATUSES_CONSUMED] },
        },
      });

      if (lotsWithStock > 0) {
        throw new BusinessRuleError(
          `El material ${before.code} todavía tiene ${lotsWithStock} ${
            lotsWithStock === 1 ? "rollo" : "rollos"
          } con existencia. Dales salida antes de darlo de baja.`,
        );
      }

      const material = await repository.delete(id);

      await this.auditWith(tx).record({
        entity: "Material",
        entityId: id,
        action: "DELETE",
        reference: before.code,
        oldValue: before,
        newValue: material,
        sensitivity: "HIGH",
        reason,
      });

      return material;
    });
  }

  /** Traduce el input validado a lo que espera Prisma. */
  private toData(input: MaterialInput) {
    return {
      code: input.code,
      name: input.name,
      type: input.type,
      baseUnit: input.baseUnit,
      subtype: input.subtype,
      description: input.description,
      purchaseUnit: input.purchaseUnit,
      purchaseFactor: input.purchaseFactor,
      composition: input.composition,
      colorName: input.colorName,
      colorHex: input.colorHex,
      widthMm: input.widthMm,
      // Grosor y onzas conviven: tela plana se especifica en mm, la
      // mezclilla en oz/yd². Se guardan los dos y la interfaz muestra el
      // que esté lleno.
      thicknessMm: input.thicknessMm,
      weightOz: input.weightOz,
      gsm: input.gsm,
      shrinkagePct: input.shrinkagePct,
      finish: input.finish,
      minStock: input.minStock,
      reorderPoint: input.reorderPoint,
      remnantThreshold: input.remnantThreshold,
      requiresShade: input.requiresShade,
      lotControlled: input.lotControlled,
      lastCost: input.lastCost,
      costCurrency: input.costCurrency,
      active: input.active,
    };
  }
}
