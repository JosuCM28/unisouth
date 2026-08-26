"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown } from "lucide-react";
import { applicableRulesAction } from "@/app/actions/standing-rule.actions";
import type { StandingRuleWithClient } from "@/lib/repositories/standing-rule.repository";
import { runAction } from "@/lib/offline/run-action";
import { RuleCard } from "@/components/rules/rule-card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Props {
  /** Empresa dueña del trabajo. Vacío = sólo se muestran las de la casa. */
  clientId?: string;
}

/**
 * Las reglas que aplican a lo que se está capturando.
 *
 * Ésta es la razón de ser del módulo: una regla que hay que ir a buscar no
 * evita el error, porque quien la olvidó tampoco se acuerda de ir a buscarla.
 * Aquí se muestra sola, en la pantalla donde se decide el corte, en cuanto se
 * elige la empresa.
 *
 * Las CRÍTICAS se ven siempre, desplegadas. Las demás van plegadas: son
 * contexto, y desplegarlas todas empujaría la captura fuera de la pantalla
 * del celular.
 */
export function ApplicableRules({ clientId }: Props) {
  const [rules, setRules] = useState<StandingRuleWithClient[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await runAction(() =>
        applicableRulesAction({ clientId: clientId ?? "" }),
      );

      // La empresa pudo cambiar mientras la consulta iba en camino: pintar
      // una respuesta vieja mostraría las reglas del cliente equivocado, que
      // es peor que no mostrar ninguna.
      if (cancelled) return;

      setRules(result.success ? result.data : []);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (rules.length === 0) return null;

  const critical = rules.filter((rule) => rule.critical);
  const rest = rules.filter((rule) => !rule.critical);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <BookOpen className="size-4 text-muted-foreground" aria-hidden />
          Reglas que aplican
          <span className="tabular text-xs font-normal text-muted-foreground">
            {rules.length}
          </span>
        </h2>

        <Link
          href="/rules"
          className="touch-target text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Ver todas
        </Link>
      </div>

      {/* Las críticas no se pueden plegar: son justo las que no se deben
          poder ignorar de un toque. */}
      {critical.map((rule) => (
        <RuleCard key={rule.id} rule={rule} />
      ))}

      {rest.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="touch-target w-full justify-between"
            >
              <span className="text-sm">
                {rest.length === 1
                  ? "1 regla más"
                  : `${rest.length} reglas más`}
              </span>
              <ChevronDown
                className={cn("size-4 transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="flex flex-col gap-2 pt-2">
            {rest.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
