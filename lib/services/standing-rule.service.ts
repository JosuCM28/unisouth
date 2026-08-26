import type { StandingRule } from "@prisma/client";
import type { PrismaExecutor } from "@/lib/prisma";
import { NotFoundError } from "@/lib/core/errors";
import type { StandingRuleInput } from "@/lib/validations/standing-rule.schema";
import { BaseService } from "./base.service";

/**
 * Reglas fijas: lo que SIEMPRE aplica y nadie debería tener que preguntar.
 *
 * "El corte de Ternium siempre lleva bolsa y bordado" no es una tarea que se
 * termina ni una nota de un embarque: es una condición permanente del trato
 * con ese cliente. Hoy vive en la memoria de una persona, y el día que falta
 * esa persona la prenda sale mal.
 *
 * No hay clave única a propósito: dos reglas pueden decir cosas parecidas para
 * empresas distintas, y forzar unicidad haría que la segunda se rechazara sin
 * que el auxiliar entienda por qué.
 */
export class StandingRuleService extends BaseService {
  async create(input: StandingRuleInput): Promise<StandingRule> {
    return this.transaction(async (tx) => {
      const rule = await tx.standingRule.create({
        data: {
          title: input.title,
          detail: input.detail,
          clientId: input.clientId,
          topic: input.topic,
          critical: input.critical,
          active: input.active,
          // Al final de su grupo: la regla nueva no se cuela arriba de las
          // que ya estaban ordenadas a mano.
          position: await this.nextPosition(tx, input.clientId),
          createdById: this.context.userId,
        },
      });

      await this.auditWith(tx).record({
        entity: "StandingRule",
        entityId: rule.id,
        action: "CREATE",
        reference: rule.title,
        newValue: rule,
        sensitivity: "LOW",
      });

      return rule;
    });
  }

  async update(id: string, input: StandingRuleInput): Promise<StandingRule> {
    return this.transaction(async (tx) => {
      const before = await tx.standingRule.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("la regla", id);

      const rule = await tx.standingRule.update({
        where: { id },
        data: {
          title: input.title,
          detail: input.detail,
          clientId: input.clientId ?? null,
          topic: input.topic,
          critical: input.critical,
          active: input.active,
        },
      });

      /* MEDIUM y no LOW: cambiar el texto de una regla cambia lo que el
         taller va a hacer mañana. Si sale una prenda mal, hay que poder ver
         qué decía la regla antes y quién la cambió. */
      await this.auditWith(tx).record({
        entity: "StandingRule",
        entityId: id,
        action: "UPDATE",
        reference: rule.title,
        oldValue: before,
        newValue: rule,
        sensitivity: "MEDIUM",
      });

      return rule;
    });
  }

  /**
   * Baja lógica.
   *
   * No se borra la fila: una regla retirada explica por qué durante dos años
   * las prendas salieron de cierta forma. Para dejar de verla sin perderla,
   * lo normal es apagarla con `active`; esto es para las que ya ni siquiera
   * deben aparecer en la administración.
   */
  async remove(id: string, reason?: string): Promise<StandingRule> {
    return this.transaction(async (tx) => {
      const before = await tx.standingRule.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("la regla", id);

      const rule = await tx.standingRule.update({
        where: { id },
        data: { deletedAt: new Date(), active: false },
      });

      await this.auditWith(tx).record({
        entity: "StandingRule",
        entityId: id,
        action: "DELETE",
        reference: before.title,
        oldValue: before,
        newValue: rule,
        sensitivity: "HIGH",
        reason,
      });

      return rule;
    });
  }

  /** Prende o apaga la regla sin abrir el formulario completo. */
  async toggle(id: string, active: boolean): Promise<StandingRule> {
    return this.transaction(async (tx) => {
      const before = await tx.standingRule.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("la regla", id);

      const rule = await tx.standingRule.update({
        where: { id },
        data: { active },
      });

      await this.auditWith(tx).record({
        entity: "StandingRule",
        entityId: id,
        action: "UPDATE",
        reference: before.title,
        oldValue: { active: before.active },
        newValue: { active },
        sensitivity: "MEDIUM",
      });

      return rule;
    });
  }

  /**
   * La siguiente posición dentro del grupo de esa empresa.
   *
   * Por empresa y no global: el orden manual se lee dentro de la lista de un
   * cliente, y un contador único haría que las posiciones de Ternium y las de
   * la casa se entrelazaran sin significar nada.
   */
  private async nextPosition(
    tx: PrismaExecutor,
    clientId?: string,
  ): Promise<number> {
    const last = await tx.standingRule.findFirst({
      where: { clientId: clientId ?? null, deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    return (last?.position ?? -1) + 1;
  }
}
