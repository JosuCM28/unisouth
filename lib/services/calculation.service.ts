import type { BomLine, Lot, Prisma, Unit } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { STATUSES_ISSUABLE } from "@/lib/constants/lot-status";
import { NotFoundError } from "@/lib/core/errors";
import type { CalculationFormInput } from "@/lib/validations/calculation.schema";
import { BaseService } from "./base.service";
import { round4 } from "./inventory.service";

// ═══════════════════════════════════════════════════════════════════════════
//  Tipos del resultado
// ═══════════════════════════════════════════════════════════════════════════

export interface SuggestedLot {
  lotId: string;
  code: string;
  shade: string | null;
  location: string | null;
  quantity: number;
  isRemnant: boolean;
}

export interface RequirementResult {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: Unit;

  baseQuantity: number;
  appliedWastePct: number;
  requiredQuantity: number;

  totalStock: number;
  reservedStock: number;
  availableStock: number;
  remnantStock: number;
  inTransit: number;

  shortage: number;
  sufficient: boolean;

  suggestedLots: SuggestedLot[];
  warnings: string[];
}

/** Lo que se va acumulando por material mientras se explota la ficha. */
interface Accumulator {
  materialId: string;
  unit: Unit;
  baseQuantity: number;
  /**
   * Suma de (merma_de_línea × cantidad_de_esa_línea).
   *
   * Se guarda el producto y no el porcentaje para poder ponderar al final:
   * una línea de 900 m al 3% y otra de 100 m al 20% no dan 11.5% de merma,
   * dan 4.7%. Promediar a secas sobreestimaría la compra.
   */
  weightedWaste: number;
}

// ═══════════════════════════════════════════════════════════════════════════
//  La fórmula
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compone dos mermas. NO se suman.
 *
 * Un 5% de merma de línea sobre un 3% global no es 8%: el 5% se aplica sobre
 * una cantidad que ya venía inflada por el 3%. Sumarlas subestima la compra
 * y el material se acaba a media producción.
 *
 *   (1 + 0.05) × (1 + 0.03) − 1 = 8.15%
 */
export function combineWaste(linePct: number, globalPct: number): number {
  return round4(((1 + linePct / 100) * (1 + globalPct / 100) - 1) * 100);
}

interface LineConsumptionInput {
  consumptionPerUnit: number;
  quantity: number;
  sizeFactor: number;
  /** Cantidad fija por CORRIDA, no por pieza (un trazo de papel, p. ej.). */
  isFixedQuantity: boolean;
  /**
   * La línea trae su propia talla. Entonces su consumo ya está medido para
   * esa talla y NO se vuelve a escalar.
   */
  hasOwnSize: boolean;
}

/**
 * Consumo de UNA línea de ficha técnica.
 *
 * Vive aparte y sin dependencias para poder probarla aislada: es la fórmula
 * de la que cuelga todo lo demás.
 */
export function computeLineConsumption(input: LineConsumptionInput): number {
  // Cantidad fija por corrida: da igual si son 10 piezas o 5,000.
  if (input.isFixedQuantity) {
    return round4(input.consumptionPerUnit);
  }

  // Una BomLine con talla propia ya está medida para esa talla; volver a
  // multiplicar por el factor la contaría dos veces.
  const factor = input.hasOwnSize ? 1 : input.sizeFactor;

  return round4(input.consumptionPerUnit * input.quantity * factor);
}

// ═══════════════════════════════════════════════════════════════════════════
//  El servicio
// ═══════════════════════════════════════════════════════════════════════════

type BomLineWithRelations = BomLine & {
  material: { id: string; code: string; name: string; requiresShade: boolean };
};

type LotCandidate = Lot & {
  location: { code: string } | null;
};

/**
 * Motor de cálculo de requerimientos.
 *
 * Responde "para producir esto, ¿qué me falta comprar?". El resultado se
 * congela como SNAPSHOT: si mañana cambia la ficha o llega material, el
 * cálculo viejo sigue mostrando los números con los que se decidió.
 */
export class CalculationService extends BaseService {
  async run(input: CalculationFormInput) {
    return this.transaction(async (tx) => {
      const code = await this.sequencesWith(tx).next("CALCULATION", "CALC", 4);

      const accumulators = await this.explodeLines(tx, input);

      const requirements: RequirementResult[] = [];
      for (const accumulator of accumulators.values()) {
        requirements.push(
          await this.resolveAvailability(tx, accumulator, input),
        );
      }

      const totalUnits = input.lines.reduce(
        (sum, line) => sum + line.quantity,
        0,
      );
      const hasShortages = requirements.some((r) => !r.sufficient);

      const calculation = await tx.calculation.create({
        data: {
          code,
          name: input.name,
          type: "SIMULATION",
          status: "DRAFT",
          clientId: input.clientId,
          productionRunId: input.productionRunId,
          respectOwnership: input.respectOwnership,
          includeRemnants: input.includeRemnants,
          safetyFactorPct: input.safetyMarginPct,
          totalUnits,
          hasShortages,
          calculatedAt: new Date(),
          createdById: this.context.userId,
          notes: input.notes,

          lines: {
            create: input.lines.map((line, index) => ({
              productId: line.productId,
              bomId: line.bomId,
              sizeId: line.sizeId,
              variantId: line.variantId,
              quantity: line.quantity,
              order: index,
            })),
          },

          // SNAPSHOT: estos números no se recalculan al abrir el cálculo.
          requirements: {
            create: requirements.map((requirement) => ({
              materialId: requirement.materialId,
              unit: requirement.unit,
              baseQuantity: requirement.baseQuantity,
              appliedWastePct: requirement.appliedWastePct,
              requiredQuantity: requirement.requiredQuantity,
              totalStock: requirement.totalStock,
              reservedStock: requirement.reservedStock,
              availableStock: requirement.availableStock,
              remnantStock: requirement.remnantStock,
              inTransit: requirement.inTransit,
              shortage: requirement.shortage,
              sufficient: requirement.sufficient,
              suggestedLots:
                requirement.suggestedLots as unknown as Prisma.InputJsonValue,
              warnings: requirement.warnings,
            })),
          },
        },
      });

      await this.auditWith(tx).record({
        entity: "Calculation",
        entityId: calculation.id,
        action: "CREATE",
        reference: code,
        newValue: { code, totalUnits, hasShortages },
        sensitivity: "LOW",
      });

      return { calculation, requirements };
    });
  }

  /**
   * Recorre las líneas del cálculo y explota cada ficha técnica en materiales.
   *
   * Devuelve un acumulador por material: dos productos distintos que usan la
   * misma mezclilla se suman en una sola necesidad de compra.
   */
  private async explodeLines(
    tx: PrismaExecutor,
    input: CalculationFormInput,
  ): Promise<Map<string, Accumulator>> {
    const accumulators = new Map<string, Accumulator>();

    for (const line of input.lines) {
      const bom = await tx.billOfMaterials.findUnique({
        where: { id: line.bomId },
        include: {
          lines: {
            include: {
              material: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  requiresShade: true,
                },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      });

      if (!bom) throw new NotFoundError("la ficha técnica", line.bomId);

      const sizeFactor = await this.resolveSizeFactor(tx, line);
      const globalWastePct = Number(bom.globalWastePct);

      for (const bomLine of bom.lines as BomLineWithRelations[]) {
        // Una línea con talla propia sólo aplica a ESA talla: la manga corta
        // de la CH no se consume al producir la XG.
        if (
          bomLine.sizeId &&
          line.sizeId &&
          bomLine.sizeId !== line.sizeId
        ) {
          continue;
        }

        const consumption = computeLineConsumption({
          consumptionPerUnit: Number(bomLine.consumptionPerUnit),
          quantity: line.quantity,
          sizeFactor,
          isFixedQuantity: bomLine.isFixedQuantity,
          hasOwnSize: Boolean(bomLine.sizeId),
        });

        if (consumption <= 0) continue;

        const wastePct = combineWaste(
          Number(bomLine.wastePct),
          globalWastePct,
        );

        const existing = accumulators.get(bomLine.materialId);

        if (existing) {
          existing.baseQuantity = round4(existing.baseQuantity + consumption);
          existing.weightedWaste = round4(
            existing.weightedWaste + wastePct * consumption,
          );
          continue;
        }

        accumulators.set(bomLine.materialId, {
          materialId: bomLine.materialId,
          unit: bomLine.unit,
          baseQuantity: consumption,
          weightedWaste: round4(wastePct * consumption),
        });
      }
    }

    return accumulators;
  }

  /**
   * Factor de escalado de la línea.
   *
   * Prioridad: la variante manda sobre la talla, porque se creó justo para
   * los casos donde el escalado lineal no aplica. Sin ninguna de las dos, 1.
   */
  private async resolveSizeFactor(
    tx: PrismaExecutor,
    line: CalculationFormInput["lines"][number],
  ): Promise<number> {
    if (line.variantId) {
      const variant = await tx.variant.findUnique({
        where: { id: line.variantId },
        include: { size: { select: { consumptionFactor: true } } },
      });

      if (variant?.consumptionFactorOverride) {
        return Number(variant.consumptionFactorOverride);
      }
      if (variant?.size) return Number(variant.size.consumptionFactor);
    }

    if (line.sizeId) {
      const size = await tx.size.findUnique({
        where: { id: line.sizeId },
        select: { consumptionFactor: true },
      });
      if (size) return Number(size.consumptionFactor);
    }

    return 1;
  }

  /**
   * Cuánto hay de este material y cuánto falta.
   *
   * Aquí se aplica el resto de la fórmula: la merma ponderada, el margen de
   * seguridad, y la búsqueda de lotes en el orden en que deben surtirse.
   */
  private async resolveAvailability(
    tx: PrismaExecutor,
    accumulator: Accumulator,
    input: CalculationFormInput,
  ): Promise<RequirementResult> {
    const material = await tx.material.findUnique({
      where: { id: accumulator.materialId },
      select: { id: true, code: true, name: true, requiresShade: true },
    });

    if (!material) {
      throw new NotFoundError("el material", accumulator.materialId);
    }

    // La merma se pondera por cantidad: las líneas grandes pesan más que las
    // chicas al decidir cuánto material extra comprar.
    const appliedWastePct =
      accumulator.baseQuantity > 0
        ? round4(accumulator.weightedWaste / accumulator.baseQuantity)
        : 0;

    const requiredQuantity = round4(
      accumulator.baseQuantity *
        (1 + appliedWastePct / 100) *
        (1 + input.safetyMarginPct / 100),
    );

    // Retazos primero, luego FIFO: es el mismo orden en que se surte.
    const candidates = (await tx.lot.findMany({
      where: {
        materialId: accumulator.materialId,
        status: { in: [...STATUSES_ISSUABLE] },
        isBlocked: false,
        currentQuantity: { gt: 0 },
        // La tela es del cliente que manda a maquilar: su material no surte
        // la producción de otro.
        ...(input.respectOwnership && input.clientId
          ? { clientId: input.clientId }
          : {}),
        ...(input.includeRemnants ? {} : { isRemnant: false }),
      },
      orderBy: [{ isRemnant: "desc" }, { receivedAt: "asc" }],
      include: { location: { select: { code: true } } },
    })) as LotCandidate[];

    let totalStock = 0;
    let reservedStock = 0;
    let remnantStock = 0;

    for (const lot of candidates) {
      totalStock = round4(totalStock + Number(lot.currentQuantity));
      reservedStock = round4(reservedStock + Number(lot.reservedQuantity));
      if (lot.isRemnant) {
        remnantStock = round4(remnantStock + Number(lot.currentQuantity));
      }
    }

    const availableStock = round4(totalStock - reservedStock);
    const suggestedLots = this.pickLots(candidates, requiredQuantity);
    const shortage = round4(Math.max(0, requiredQuantity - availableStock));

    return {
      materialId: material.id,
      materialCode: material.code,
      materialName: material.name,
      unit: accumulator.unit,
      baseQuantity: accumulator.baseQuantity,
      appliedWastePct,
      requiredQuantity,
      totalStock,
      reservedStock,
      availableStock,
      remnantStock,
      // Sin módulo de compras enlazado todavía: se deja en 0 explícitamente.
      inTransit: 0,
      shortage,
      sufficient: shortage === 0,
      suggestedLots,
      warnings: this.buildWarnings({
        material,
        suggestedLots,
        shortage,
        requiredQuantity,
        availableStock,
      }),
    };
  }

  /**
   * Qué rollos tomar y cuánto de cada uno.
   *
   * Se va llenando en el orden de surtido hasta cubrir lo requerido; del
   * último rollo se toma sólo el pedazo que falta.
   */
  private pickLots(
    candidates: LotCandidate[],
    required: number,
  ): SuggestedLot[] {
    const picked: SuggestedLot[] = [];
    let pending = required;

    for (const lot of candidates) {
      if (pending <= 0) break;

      const usable = round4(
        Number(lot.currentQuantity) - Number(lot.reservedQuantity),
      );
      if (usable <= 0) continue;

      const take = round4(Math.min(usable, pending));
      pending = round4(pending - take);

      picked.push({
        lotId: lot.id,
        code: lot.code,
        shade: lot.shade,
        location: lot.location?.code ?? null,
        quantity: take,
        isRemnant: lot.isRemnant,
      });
    }

    return picked;
  }

  /** Advertencias que el usuario debe leer ANTES de mandar a cortar. */
  private buildWarnings(input: {
    material: { name: string; requiresShade: boolean };
    suggestedLots: SuggestedLot[];
    shortage: number;
    requiredQuantity: number;
    availableStock: number;
  }): string[] {
    const warnings: string[] = [];

    // Mezclar dos partidas de tintura en un mismo tendido saca la prenda con
    // franjas y se rechaza. Vale más avisarlo antes de cortar.
    if (input.material.requiresShade) {
      const shades = new Set(
        input.suggestedLots
          .map((lot) => lot.shade)
          .filter((shade): shade is string => Boolean(shade)),
      );

      if (shades.size > 1) {
        warnings.push(
          `Se mezclarían ${shades.size} tonos (${[...shades].join(", ")}). Dos tonos en un mismo tendido salen con franjas.`,
        );
      }
    }

    if (input.shortage > 0) {
      warnings.push(
        `Faltan ${input.shortage} para completar. Hay ${input.availableStock} de ${input.requiredQuantity}.`,
      );
    }

    return warnings;
  }
}
