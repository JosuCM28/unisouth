import { AlertTriangle } from "lucide-react";
import type { StandingRuleWithClient } from "@/lib/repositories/standing-rule.repository";
import { STANDING_RULE_TOPIC_LABELS } from "@/lib/constants/labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Props {
  rule: StandingRuleWithClient;
  /** El menú de editar/apagar/borrar. Sin permiso no se pasa y no se pinta. */
  actions?: React.ReactNode;
  /** En la salida ya se sabe de quién es el trabajo: repetirlo estorba. */
  hideClient?: boolean;
}

/**
 * Una regla, como se lee en pantalla.
 *
 * La misma tarjeta sirve en la pantalla de Reglas y dentro del formulario de
 * salida: si la regla se viera distinta en los dos lados, el auxiliar tendría
 * que aprender a leerla dos veces.
 *
 * La crítica se distingue por BORDE y fondo sólido, no por sombra: es la
 * jerarquía del sistema y además es lo único que se alcanza a ver con la luz
 * de la bodega.
 */
export function RuleCard({ rule, actions, hideClient }: Props) {
  return (
    <article
      className={cn(
        "flex items-start gap-3 border p-3",
        rule.critical
          ? "border-state-defective bg-state-defective-muted"
          : "border-border bg-card",
        // Apagada: se ve pero se ve apagada. No se esconde, porque saber que
        // existió una regla y ya no aplica también es información.
        !rule.active && "opacity-60",
      )}
    >
      {rule.critical && (
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-state-defective"
          aria-hidden
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{rule.title}</p>

        {rule.detail && (
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
            {rule.detail}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {STANDING_RULE_TOPIC_LABELS[rule.topic]}
          </Badge>

          {!hideClient && (
            <Badge variant="outline" className="text-xs">
              {rule.client?.name ?? "Todas las empresas"}
            </Badge>
          )}

          {!rule.active && (
            <Badge variant="secondary" className="text-xs">
              Ya no aplica
            </Badge>
          )}
        </div>
      </div>

      {actions && <div className="shrink-0">{actions}</div>}
    </article>
  );
}
