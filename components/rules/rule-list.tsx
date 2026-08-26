import { BookOpen, Building2 } from "lucide-react";
import type { StandingRuleWithClient } from "@/lib/repositories/standing-rule.repository";
import { EmptyState } from "@/components/shared/empty-state";
import { RuleActions } from "./rule-actions";
import { RuleCard } from "./rule-card";

interface Props {
  rules: StandingRuleWithClient[];
  clients: { id: string; name: string }[];
  /** Sin `catalog:write` se ve todo pero no se toca nada. */
  canEdit: boolean;
}

/** Un grupo de la lista: una empresa con sus reglas. */
interface RuleGroup {
  key: string;
  title: string;
  /** Por qué existe el grupo. Se explica en la casa, que no es obvia. */
  description?: string;
  rules: StandingRuleWithClient[];
}

/**
 * Las reglas agrupadas POR EMPRESA.
 *
 * Agrupar por empresa y no por tema porque así es como se consultan: la
 * pregunta real nunca es "¿qué reglas de corte tengo?", es "¿qué debo saber
 * antes de tocar un trabajo de Ternium?". El tema sirve para ordenar dentro
 * del grupo, no para partirlo.
 *
 * Las reglas de la casa van PRIMERO: aplican a todos los trabajos, incluidos
 * los de la empresa que se esté consultando.
 */
export function RuleList({ rules, clients, canEdit }: Props) {
  if (rules.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={BookOpen}
          title="Todavía no hay reglas"
          description="Aquí va lo que siempre aplica y hoy vive en la memoria de alguien: que el corte de tal empresa siempre lleva bolsa y bordado, que tal tela se prelava. Regístralo una vez y deja de depender de que alguien se acuerde."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groupByClient(rules).map((group) => (
        <section key={group.key} className="flex flex-col gap-2">
          <header className="flex items-baseline gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Building2 className="size-4 text-muted-foreground" aria-hidden />
              {group.title}
            </h2>
            <span className="tabular text-xs text-muted-foreground">
              {group.rules.length}
            </span>
          </header>

          {group.description && (
            <p className="text-xs text-muted-foreground">{group.description}</p>
          )}

          <div className="flex flex-col gap-2">
            {group.rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                hideClient
                actions={
                  canEdit ? (
                    <RuleActions rule={rule} clients={clients} />
                  ) : undefined
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Parte la lista en grupos, respetando el orden que ya trae el repositorio.
 *
 * No reordena las reglas: llegan con las críticas arriba y eso se conserva
 * dentro de cada grupo.
 */
function groupByClient(rules: StandingRuleWithClient[]): RuleGroup[] {
  const house: StandingRuleWithClient[] = [];
  const byClient = new Map<string, RuleGroup>();

  for (const rule of rules) {
    if (!rule.client) {
      house.push(rule);
      continue;
    }

    const existing = byClient.get(rule.client.id);

    if (existing) {
      existing.rules.push(rule);
      continue;
    }

    byClient.set(rule.client.id, {
      key: rule.client.id,
      title: rule.client.name,
      rules: [rule],
    });
  }

  const groups = [...byClient.values()].sort((a, b) =>
    a.title.localeCompare(b.title, "es"),
  );

  if (house.length === 0) return groups;

  return [
    {
      key: "__house__",
      title: "Todas las empresas",
      description:
        "Reglas de la casa: aplican a cualquier trabajo, sea de quien sea.",
      rules: house,
    },
    ...groups,
  ];
}
