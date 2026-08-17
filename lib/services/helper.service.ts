import type { Helper } from "@prisma/client";
import { BusinessRuleError, DuplicateError, NotFoundError } from "@/lib/core/errors";
import type { HelperInput } from "@/lib/validations/helper.schema";
import { BaseService } from "./base.service";

/**
 * Ayudantes de descarga.
 *
 * No son usuarios del sistema: nunca entran a la app. Sólo se les nombra en
 * cada rollo para poder calcular su bonificación por descarga.
 */
export class HelperService extends BaseService {
  async create(input: HelperInput): Promise<Helper> {
    return this.transaction(async (tx) => {
      // El nombre es la clave natural: así se le dice en el andén.
      const exists = await tx.helper.findFirst({
        where: { name: input.name, deletedAt: null },
      });
      if (exists) {
        throw new DuplicateError("el ayudante", "nombre", input.name, "name");
      }

      const helper = await tx.helper.create({ data: input });

      await this.auditWith(tx).record({
        entity: "Helper", entityId: helper.id, action: "CREATE",
        reference: helper.name, newValue: helper, sensitivity: "LOW",
      });

      return helper;
    });
  }

  async update(id: string, input: HelperInput): Promise<Helper> {
    return this.transaction(async (tx) => {
      const before = await tx.helper.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("el ayudante", id);

      const duplicate = await tx.helper.findFirst({
        where: { name: input.name, deletedAt: null, id: { not: id } },
      });
      if (duplicate) {
        throw new DuplicateError("el ayudante", "nombre", input.name, "name");
      }

      const helper = await tx.helper.update({ where: { id }, data: input });

      await this.auditWith(tx).record({
        entity: "Helper", entityId: id, action: "UPDATE",
        reference: helper.name, oldValue: before, newValue: helper,
        sensitivity: "MEDIUM",
      });

      return helper;
    });
  }

  /**
   * Baja lógica.
   *
   * Se niega si ya descargó rollos: su historial sostiene las bonificaciones
   * que ya se le pagaron, y borrarlo dejaría esos rollos sin responsable.
   */
  async remove(id: string, reason?: string): Promise<Helper> {
    return this.transaction(async (tx) => {
      const before = await tx.helper.findUnique({
        where: { id },
        include: { _count: { select: { lots: true } } },
      });
      if (!before) throw new NotFoundError("el ayudante", id);

      if (before._count.lots > 0) {
        throw new BusinessRuleError(
          `${before.name} tiene ${before._count.lots} ${
            before._count.lots === 1 ? "rollo descargado" : "rollos descargados"
          }. Desactívalo en vez de borrarlo, para no perder su historial.`,
        );
      }

      const helper = await tx.helper.update({
        where: { id }, data: { deletedAt: new Date(), active: false },
      });

      await this.auditWith(tx).record({
        entity: "Helper", entityId: id, action: "DELETE",
        reference: before.name, oldValue: before, newValue: helper,
        sensitivity: "HIGH", reason,
      });

      return helper;
    });
  }
}
