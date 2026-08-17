import type { BillOfMaterials } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { NotFoundError } from "@/lib/core/errors";
import type { BomInput } from "@/lib/validations/bom.schema";
import { BaseService } from "./base.service";

export interface BomSaveResult {
  bom: BillOfMaterials;
  /** true si se creó una versión nueva en vez de editar la existente. */
  versioned: boolean;
}

/**
 * Fichas técnicas.
 *
 * La regla central: una ficha que ya se usó para calcular NO se edita. Si se
 * editara, los cálculos viejos dejarían de ser reproducibles y nadie podría
 * explicar por qué se compraron 1,200 metros aquel día.
 */
export class BomService extends BaseService {
  async create(input: BomInput): Promise<BillOfMaterials> {
    return this.transaction(async (tx) => {
      const version = await this.nextVersion(tx, input.productId);

      const bom = await tx.billOfMaterials.create({
        data: {
          productId: input.productId,
          version,
          name: input.name,
          status: input.status,
          globalWastePct: input.globalWastePct,
          notes: input.notes,
          createdById: this.context.userId,
          lines: {
            create: input.lines.map((line, index) => ({
              materialId: line.materialId,
              consumptionPerUnit: line.consumptionPerUnit,
              unit: line.unit,
              wastePct: line.wastePct,
              sizeId: line.sizeId,
              isFixedQuantity: line.isFixedQuantity,
              optional: line.optional,
              part: line.part,
              notes: line.notes,
              order: index,
            })),
          },
        },
      });

      await this.auditWith(tx).record({
        entity: "BillOfMaterials",
        entityId: bom.id,
        action: "CREATE",
        reference: `v${version}`,
        newValue: { version, lines: input.lines.length },
        sensitivity: "LOW",
      });

      return bom;
    });
  }

  /**
   * Guarda cambios en una ficha.
   *
   * Si la ficha está ACTIVE y ya la usó algún cálculo, NO se toca: se crea
   * una v2 con los cambios y la vieja queda como OBSOLETE. Los cálculos
   * apuntan a `bomId`, así que siguen mostrando la receta con la que se
   * corrieron.
   */
  async update(id: string, input: BomInput): Promise<BomSaveResult> {
    return this.transaction(async (tx) => {
      const current = await tx.billOfMaterials.findUnique({
        where: { id },
        include: { _count: { select: { calculationLines: true } } },
      });

      if (!current) throw new NotFoundError("la ficha técnica", id);

      const wasUsed = current._count.calculationLines > 0;
      const isActive = current.status === "ACTIVE";

      if (wasUsed && isActive) {
        const bom = await this.createVersionFrom(tx, current.productId, input);

        // La vieja se marca obsoleta, pero se conserva: los cálculos que la
        // usaron deben poder seguir leyéndola.
        await tx.billOfMaterials.update({
          where: { id },
          data: { status: "OBSOLETE", effectiveTo: new Date() },
        });

        await this.auditWith(tx).record({
          entity: "BillOfMaterials",
          entityId: bom.id,
          action: "CREATE",
          reference: `v${bom.version}`,
          oldValue: { version: current.version, status: current.status },
          newValue: { version: bom.version, reason: "Ficha ya usada por un cálculo" },
          sensitivity: "MEDIUM",
        });

        return { bom, versioned: true };
      }

      // Borrador o sin usar: se puede editar en sitio. Los renglones se
      // reemplazan completos porque reconciliar uno por uno no aporta nada.
      await tx.bomLine.deleteMany({ where: { bomId: id } });

      const bom = await tx.billOfMaterials.update({
        where: { id },
        data: {
          name: input.name,
          status: input.status,
          globalWastePct: input.globalWastePct,
          notes: input.notes,
          lines: {
            create: input.lines.map((line, index) => ({
              materialId: line.materialId,
              consumptionPerUnit: line.consumptionPerUnit,
              unit: line.unit,
              wastePct: line.wastePct,
              sizeId: line.sizeId,
              isFixedQuantity: line.isFixedQuantity,
              optional: line.optional,
              part: line.part,
              notes: line.notes,
              order: index,
            })),
          },
        },
      });

      await this.auditWith(tx).record({
        entity: "BillOfMaterials",
        entityId: bom.id,
        action: "UPDATE",
        reference: `v${bom.version}`,
        oldValue: { globalWastePct: current.globalWastePct },
        newValue: { globalWastePct: input.globalWastePct, lines: input.lines.length },
        sensitivity: "MEDIUM",
      });

      return { bom, versioned: false };
    });
  }

  /** Activa una ficha y jubila la que estaba activa del mismo producto. */
  async activate(id: string): Promise<BillOfMaterials> {
    return this.transaction(async (tx) => {
      const bom = await tx.billOfMaterials.findUnique({ where: { id } });
      if (!bom) throw new NotFoundError("la ficha técnica", id);

      // Sólo una ficha activa por producto: si hubiera dos, el cálculo no
      // sabría cuál usar.
      await tx.billOfMaterials.updateMany({
        where: { productId: bom.productId, status: "ACTIVE", id: { not: id } },
        data: { status: "OBSOLETE", effectiveTo: new Date() },
      });

      const activated = await tx.billOfMaterials.update({
        where: { id },
        data: {
          status: "ACTIVE",
          effectiveFrom: new Date(),
          approvedById: this.context.userId,
          approvedAt: new Date(),
        },
      });

      await this.auditWith(tx).record({
        entity: "BillOfMaterials",
        entityId: id,
        action: "APPROVE",
        reference: `v${activated.version}`,
        oldValue: { status: bom.status },
        newValue: { status: "ACTIVE" },
        sensitivity: "MEDIUM",
      });

      return activated;
    });
  }

  private async createVersionFrom(
    tx: PrismaExecutor,
    productId: string,
    input: BomInput,
  ): Promise<BillOfMaterials> {
    const version = await this.nextVersion(tx, productId);

    return tx.billOfMaterials.create({
      data: {
        productId,
        version,
        name: input.name,
        status: "ACTIVE",
        globalWastePct: input.globalWastePct,
        notes: input.notes,
        effectiveFrom: new Date(),
        createdById: this.context.userId,
        lines: {
          create: input.lines.map((line, index) => ({
            materialId: line.materialId,
            consumptionPerUnit: line.consumptionPerUnit,
            unit: line.unit,
            wastePct: line.wastePct,
            sizeId: line.sizeId,
            isFixedQuantity: line.isFixedQuantity,
            optional: line.optional,
            part: line.part,
            notes: line.notes,
            order: index,
          })),
        },
      },
    });
  }

  private async nextVersion(
    tx: PrismaExecutor,
    productId: string,
  ): Promise<number> {
    const last = await tx.billOfMaterials.findFirst({
      where: { productId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    return (last?.version ?? 0) + 1;
  }
}
