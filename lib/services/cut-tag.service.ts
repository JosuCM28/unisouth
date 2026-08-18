import type { CutTagOption } from "@prisma/client";
import { BusinessRuleError, DuplicateError } from "@/lib/core/errors";
import type { CutTagInput } from "@/lib/validations/cut-tag.schema";
import { BaseService } from "./base.service";

/**
 * Catálogo de foleos: los papelitos de color que se engrapan a los bultos.
 *
 * Es un catálogo y no un enum porque en el piso se acaba un color y se compra
 * otro: agregarlo no debería requerir tocar la base de datos.
 */
export class CutTagService extends BaseService {
  async create(input: CutTagInput): Promise<CutTagOption> {
    return this.transaction(async (tx) => {
      const code = input.code?.trim() ? normalize(input.code) : normalize(input.name);

      const exists = await tx.cutTagOption.findUnique({ where: { code } });
      if (exists) {
        throw new DuplicateError("el foleo", "nombre", input.name, "name");
      }

      const tag = await tx.cutTagOption.create({
        data: {
          code,
          name: input.name,
          color: input.color,
          order: input.order,
        },
      });

      await this.auditWith(tx).record({
        entity: "CutTagOption",
        entityId: tag.id,
        action: "CREATE",
        reference: tag.name,
        newValue: tag,
        sensitivity: "LOW",
      });

      return tag;
    });
  }

  async update(id: string, input: CutTagInput): Promise<CutTagOption> {
    return this.transaction(async (tx) => {
      const before = await tx.cutTagOption.findUnique({ where: { id } });
      if (!before) throw new BusinessRuleError("No se encontró el foleo.");

      /* El `code` NO se reescribe al editar: es la clave estable con la que
         quedaron enlazados los vales ya impresos. Cambiar el nombre visible
         de "Azul" a "Azul rey" es correcto; romper el enlace, no. */
      const tag = await tx.cutTagOption.update({
        where: { id },
        data: {
          name: input.name,
          color: input.color,
          order: input.order,
        },
      });

      await this.auditWith(tx).record({
        entity: "CutTagOption",
        entityId: id,
        action: "UPDATE",
        reference: tag.name,
        oldValue: before,
        newValue: tag,
        sensitivity: "LOW",
      });

      return tag;
    });
  }

  /**
   * Baja lógica.
   *
   * Nunca un DELETE físico: los vales que ya usaron ese foleo deben seguir
   * mostrando de qué color era el papelito años después. Al darlo de baja
   * simplemente deja de ofrecerse al capturar.
   */
  async remove(id: string, reason?: string): Promise<CutTagOption> {
    return this.transaction(async (tx) => {
      const before = await tx.cutTagOption.findUnique({ where: { id } });
      if (!before) throw new BusinessRuleError("No se encontró el foleo.");

      const tag = await tx.cutTagOption.update({
        where: { id },
        data: { deletedAt: new Date(), active: false },
      });

      const used = await tx.documentCutLine.count({ where: { tagId: id } });

      await this.auditWith(tx).record({
        entity: "CutTagOption",
        entityId: id,
        action: "DELETE",
        reference: before.name,
        oldValue: before,
        newValue: { active: false, usadoEn: used },
        sensitivity: "LOW",
        reason,
      });

      return tag;
    });
  }
}

/**
 * Del nombre a una clave estable: "Azul rey" → "AZUL_REY".
 *
 * Se guarda aparte del nombre para que renombrar un color no rompa el enlace
 * con los vales que ya lo usaron.
 */
function normalize(value: string): string {
  return value
    .trim()
    .toUpperCase()
    /* Los acentos fuera: "CAFÉ" y "CAFE" deben ser la misma clave. NFD separa
       la letra de su acento y el rango de marcas combinantes se borra con un
       RegExp construido, para no escribir caracteres invisibles en el código. */
    .normalize("NFD")
    .replace(new RegExp("[\u0300-\u036f]", "g"), "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
