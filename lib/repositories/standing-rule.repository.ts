import type { Prisma, StandingRule } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

/** Una regla con el nombre de la empresa ya resuelto, lista para pintar. */
export interface StandingRuleWithClient extends StandingRule {
  client: { id: string; name: string } | null;
}

/**
 * Cómo se ordenan SIEMPRE las reglas.
 *
 * Las críticas primero, porque olvidar una cuesta una prenda rechazada y el
 * auxiliar lee de arriba hacia abajo. Después el orden manual, y al final el
 * alta, para que dos reglas sin posición asignada no bailen entre recargas.
 */
const RULE_ORDER: Prisma.StandingRuleOrderByWithRelationInput[] = [
  { critical: "desc" },
  { position: "asc" },
  { createdAt: "asc" },
];

const WITH_CLIENT = {
  client: { select: { id: true, name: true } },
} satisfies Prisma.StandingRuleInclude;

export class StandingRuleRepository extends BaseRepository<
  StandingRule,
  Prisma.StandingRuleCreateInput,
  Prisma.StandingRuleUpdateInput
> {
  protected get delegate(): PrismaDelegate {
    return this.db.standingRule;
  }

  protected get entityName(): string {
    return "la regla";
  }

  /** Todas, incluidas las apagadas: la pantalla de administración las lista. */
  async findAll(): Promise<StandingRuleWithClient[]> {
    return this.db.standingRule.findMany({
      where: this.notDeleted,
      include: WITH_CLIENT,
      orderBy: RULE_ORDER,
    });
  }

  /**
   * Las reglas que aplican HOY al trabajo de una empresa.
   *
   * Devuelve las de esa empresa MÁS las de la casa (`clientId: null`), porque
   * una regla general aplica a todos los clientes por definición: dejarlas
   * fuera haría que "todo corte de mezclilla se prelava" desapareciera justo
   * cuando se está capturando un corte de mezclilla.
   *
   * Sin empresa se devuelven sólo las de la casa: las de un cliente concreto
   * no significan nada mientras no se sepa para quién es el trabajo.
   */
  async findApplicable(clientId?: string): Promise<StandingRuleWithClient[]> {
    const scope: Prisma.StandingRuleWhereInput[] = [{ clientId: null }];
    if (clientId) scope.push({ clientId });

    return this.db.standingRule.findMany({
      where: { ...this.notDeleted, active: true, OR: scope },
      include: WITH_CLIENT,
      orderBy: RULE_ORDER,
    });
  }

  /** Cuántas reglas activas tiene cada empresa, para el filtro de la lista. */
  async countByClient(): Promise<Map<string | null, number>> {
    const grouped = await this.db.standingRule.groupBy({
      by: ["clientId"],
      where: { ...this.notDeleted, active: true },
      _count: { _all: true },
    });

    return new Map(
      grouped.map((row: { clientId: string | null; _count: { _all: number } }) => [
        row.clientId,
        row._count._all,
      ]),
    );
  }
}
