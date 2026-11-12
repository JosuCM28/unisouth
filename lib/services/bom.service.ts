import type { BillOfMaterials } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { NotFoundError } from "@/lib/core/errors";
import type { BomInput, BomLineInput } from "@/lib/validations/bom.schema";
import { BaseService } from "./base.service";

export interface BomSaveResult {
  bom: BillOfMaterials;
  /** true si se creó una versión nueva en vez de editar la existente. */
  versioned: boolean;
}

/**
 * Fichas técnicas.
 *
 * Ya no hay "borrador" ni "activar": guardar es publicar. El paso de activar
 * nunca tuvo botón en el editor, así que las fichas se quedaban en borrador y
 * el producto no servía en Cálculo ni en Salidas. La vigente es la versión
 * más reciente no obsoleta (ver `CURRENT_BOM_SELECTION`).
 *
 * La regla que SÍ se conserva: una ficha que ya se usó para calcular NO se
 * edita. Si se editara, los cálculos viejos dejarían de ser reproducibles y
 * nadie podría explicar por qué se compraron 1,200 metros aquel día.
 */
export class BomService extends BaseService {
  async create(input: BomInput): Promise<BillOfMaterials> {
    return this.transaction(async (tx) => {
      const bom = await this.createVersion(tx, input);

      await this.auditWith(tx).record({
        entity: "BillOfMaterials",
        entityId: bom.id,
        action: "CREATE",
        reference: `v${bom.version}`,
        newValue: { version: bom.version, lines: input.lines.length },
        sensitivity: "LOW",
      });

      return bom;
    });
  }

  /**
   * Guarda cambios en una ficha.
   *
   * Si ya la usó algún cálculo, NO se toca: se crea una versión nueva con los
   * cambios y la vieja queda OBSOLETE. Los cálculos apuntan a `bomId`, así que
   * siguen mostrando la receta con la que se corrieron.
   */
  async update(id: string, input: BomInput): Promise<BomSaveResult> {
    return this.transaction(async (tx) => {
      const current = await tx.billOfMaterials.findUnique({
        where: { id },
        include: { _count: { select: { calculationLines: true } } },
      });

      if (!current) throw new NotFoundError("la ficha técnica", id);

      if (current._count.calculationLines > 0) {
        const bom = await this.supersede(tx, current, input);
        return { bom, versioned: true };
      }

      // Sin usar: se edita en sitio. Los renglones se reemplazan completos
      // porque reconciliar uno por uno no aporta nada.
      await tx.bomLine.deleteMany({ where: { bomId: id } });

      const bom = await tx.billOfMaterials.update({
        where: { id },
        data: {
          name: input.name,
          // Una ficha guardada antes como borrador queda vigente al guardarla.
          status: "ACTIVE",
          globalWastePct: input.globalWastePct,
          notes: input.notes,
          lines: { create: toLineRows(input.lines) },
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

  /** Crea la versión nueva y jubila la usada, que se conserva para los cálculos. */
  private async supersede(
    tx: PrismaExecutor,
    current: BillOfMaterials,
    input: BomInput,
  ): Promise<BillOfMaterials> {
    const bom = await this.createVersion(tx, { ...input, productId: current.productId });

    await tx.billOfMaterials.update({
      where: { id: current.id },
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

    return bom;
  }

  private async createVersion(
    tx: PrismaExecutor,
    input: BomInput,
  ): Promise<BillOfMaterials> {
    const version = await this.nextVersion(tx, input.productId);

    return tx.billOfMaterials.create({
      data: {
        productId: input.productId,
        version,
        name: input.name,
        status: "ACTIVE",
        globalWastePct: input.globalWastePct,
        notes: input.notes,
        effectiveFrom: new Date(),
        createdById: this.context.userId,
        lines: { create: toLineRows(input.lines) },
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

/** El orden de captura se guarda: es como el usuario lee la receta. */
function toLineRows(lines: BomLineInput[]) {
  return lines.map((line, index) => ({
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
  }));
}
