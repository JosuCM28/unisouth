import type { ProductionRun } from "@prisma/client";
import { BusinessRuleError, DuplicateError } from "@/lib/core/errors";
import { ProductionRunRepository } from "@/lib/repositories/production-run.repository";
import type { ProductionRunInput } from "@/lib/validations/production-run.schema";
import { BaseService } from "./base.service";

export class ProductionRunService extends BaseService {
  async create(input: ProductionRunInput): Promise<ProductionRun> {
    return this.transaction(async (tx) => {
      const repository = new ProductionRunRepository(tx);

      if (await repository.exists({ code: input.code })) {
        throw new DuplicateError("la producción", "código", input.code, "code");
      }

      const run = await repository.create({
        code: input.code,
        name: input.name,
        client: { connect: { id: input.clientId } },
        season: input.season,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
        notes: input.notes,
      });

      await this.auditWith(tx).record({
        entity: "ProductionRun",
        entityId: run.id,
        action: "CREATE",
        reference: run.code,
        newValue: run,
        sensitivity: "LOW",
      });

      return run;
    });
  }

  async update(id: string, input: ProductionRunInput): Promise<ProductionRun> {
    return this.transaction(async (tx) => {
      const repository = new ProductionRunRepository(tx);
      const before = await repository.findByIdOrThrow(id);

      if (await repository.exists({ code: input.code }, id)) {
        throw new DuplicateError("la producción", "código", input.code, "code");
      }

      const run = await repository.update(id, {
        code: input.code,
        name: input.name,
        client: { connect: { id: input.clientId } },
        season: input.season,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
        notes: input.notes,
      });

      await this.auditWith(tx).record({
        entity: "ProductionRun",
        entityId: run.id,
        action: "UPDATE",
        reference: run.code,
        oldValue: before,
        newValue: run,
        sensitivity: "MEDIUM",
      });

      return run;
    });
  }

  /**
   * Cancela la producción. No hay borrado: la tabla no tiene `deletedAt` y su
   * consumo histórico debe seguir siendo consultable.
   */
  async cancel(id: string, reason?: string): Promise<ProductionRun> {
    return this.transaction(async (tx) => {
      const repository = new ProductionRunRepository(tx);
      const before = await repository.findByIdOrThrow(id);

      const lotCount = await repository.countLots(id);
      if (lotCount > 0) {
        throw new BusinessRuleError(
          `La producción ${before.code} todavía tiene ${lotCount} ${
            lotCount === 1 ? "rollo asignado" : "rollos asignados"
          }. Libéralos antes de cancelarla.`,
        );
      }

      const run = await repository.update(id, { status: "CANCELLED" });

      await this.auditWith(tx).record({
        entity: "ProductionRun",
        entityId: id,
        action: "CANCEL",
        reference: before.code,
        oldValue: before,
        newValue: run,
        sensitivity: "HIGH",
        reason,
      });

      return run;
    });
  }
}
