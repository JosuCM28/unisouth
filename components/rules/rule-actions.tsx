"use client";

import { useRouter } from "next/navigation";
import { Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import {
  removeStandingRuleAction,
  toggleStandingRuleAction,
} from "@/app/actions/standing-rule.actions";
import type { StandingRuleWithClient } from "@/lib/repositories/standing-rule.repository";
import { runAction } from "@/lib/offline/run-action";
import { RowActions } from "@/components/shared/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RuleFormDialog } from "./rule-form-dialog";

interface Props {
  rule: StandingRuleWithClient;
  clients: { id: string; name: string }[];
}

/**
 * Menú de una regla: editar, apagar y borrar.
 *
 * Apagar está ANTES que borrar y es lo que se ofrece primero, porque casi
 * siempre es lo correcto: una regla que dejó de aplicar sigue explicando por
 * qué durante dos años las prendas salieron de cierta forma.
 */
export function RuleActions({ rule, clients }: Props) {
  const router = useRouter();

  async function handleToggle() {
    const result = await runAction(() =>
      toggleStandingRuleAction({ id: rule.id, active: !rule.active }),
    );

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(rule.active ? "Regla apagada" : "Regla activada");
    router.refresh();
  }

  return (
    <RowActions
      label={rule.title}
      editItem={
        <RuleFormDialog
          rule={rule}
          clients={clients}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </DropdownMenuItem>
          }
        />
      }
      extraItems={
        <DropdownMenuItem onSelect={handleToggle}>
          <Power className="size-4" aria-hidden />
          {rule.active ? "Apagar" : "Activar"}
        </DropdownMenuItem>
      }
      removeTitle="Borrar la regla"
      removeDescription="Desaparece de todas partes, incluido el historial. Si sólo dejó de aplicar, mejor apágala: así queda para consultar por qué antes se hacía así."
      onRemove={() =>
        removeStandingRuleAction({
          id: rule.id,
          reason: `Baja de la regla "${rule.title}"`,
        })
      }
    />
  );
}
