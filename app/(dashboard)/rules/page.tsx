import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { StandingRuleRepository } from "@/lib/repositories/standing-rule.repository";
import { toPlainObject } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { RuleClientFilter, HOUSE_FILTER } from "@/components/rules/rule-client-filter";
import { RuleFormDialog } from "@/components/rules/rule-form-dialog";
import { RuleList } from "@/components/rules/rule-list";
import { Button } from "@/components/ui/button";

interface PageProps {
  searchParams: Promise<{ client?: string }>;
}

export const metadata: Metadata = { title: "Reglas" };

/**
 * Reglas fijas del almacén.
 *
 * Se pide `inventory:read` y no `browse`: esto no es recorrer el almacén, es
 * consultar lo que siempre aplica. Dirección y los roles de sólo lectura
 * también necesitan poder leerlas —de nada sirve una regla que su público no
 * puede ver—. Escribirlas ya es otra cosa y pide `catalog:write`.
 */
export default async function RulesPage({ searchParams }: PageProps) {
  const user = await requirePermission("inventory:read");
  const canEdit = roleHasPermission(user.role, "catalog:write");

  const { client: clientFilter } = await searchParams;

  const repository = new StandingRuleRepository();

  const [rules, clients, counts] = await Promise.all([
    repository.findAll(),
    new ClientRepository().findOptions(),
    repository.countByClient(),
  ]);

  const visible = filterByClient(rules, clientFilter);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reglas"
        description="Lo que SIEMPRE aplica y no debería depender de que alguien se acuerde"
        action={
          canEdit ? (
            <RuleFormDialog
              clients={clients}
              trigger={
                <Button className="touch-target">
                  <Plus className="size-4" aria-hidden />
                  Nueva
                </Button>
              }
            />
          ) : undefined
        }
      />

      {/* Qué es esto, dicho una vez. Sin la explicación la pantalla se llena
          de pendientes de un día —que son Tareas— y deja de servir. */}
      <p className="flat-surface p-3 text-sm text-muted-foreground">
        Una regla es una condición permanente del trabajo:{" "}
        <span className="text-foreground">
          &ldquo;el corte de Ternium siempre lleva bolsa y bordado&rdquo;
        </span>
        . No es un pendiente ni una nota de un embarque —eso va en Tareas—:
        aplica a todos los trabajos de esa empresa hasta que alguien la retire.
      </p>

      {rules.length > 0 && (
        <RuleClientFilter
          clients={clients.map((client) => ({
            id: client.id,
            name: client.name,
            count: counts.get(client.id) ?? 0,
          }))}
          houseCount={counts.get(null) ?? 0}
        />
      )}

      <RuleList
        rules={toPlainObject(visible)}
        clients={clients}
        canEdit={canEdit}
      />
    </div>
  );
}

/**
 * Aplica el filtro de empresa.
 *
 * Al filtrar por una empresa se conservan las reglas de la casa: aplican a
 * todos sus trabajos, y esconderlas daría la respuesta incompleta justo a
 * quien preguntó "¿qué debo saber de este cliente?".
 */
function filterByClient<T extends { clientId: string | null }>(
  rules: T[],
  filter?: string,
): T[] {
  if (!filter) return rules;
  if (filter === HOUSE_FILTER) return rules.filter((rule) => !rule.clientId);

  return rules.filter(
    (rule) => rule.clientId === filter || rule.clientId === null,
  );
}
