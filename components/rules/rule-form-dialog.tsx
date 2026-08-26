"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { StandingRuleTopic } from "@prisma/client";
import {
  createStandingRuleAction,
  updateStandingRuleAction,
} from "@/app/actions/standing-rule.actions";
import {
  standingRuleFormSchema,
  type StandingRuleFormValues,
} from "@/lib/validations/standing-rule.schema";
import {
  STANDING_RULE_TOPIC_LABELS,
  STANDING_RULE_TOPIC_ORDER,
} from "@/lib/constants/labels";
import { runAction } from "@/lib/offline/run-action";
import type { StandingRuleWithClient } from "@/lib/repositories/standing-rule.repository";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const FIELDS = Object.keys(
  standingRuleFormSchema.shape,
) as (keyof StandingRuleFormValues)[];

/** Ejemplos rotativos: enseñan el tono esperado sin tener que explicarlo. */
const TITLE_PLACEHOLDER = "El corte de Ternium siempre lleva bolsa y bordado";

interface Props {
  rule?: StandingRuleWithClient;
  clients: { id: string; name: string }[];
  trigger: ReactNode;
}

/**
 * Alta y corrección de una regla fija.
 *
 * Sólo el texto es obligatorio. Empresa y tema tienen valor por defecto —todas
 * las empresas, tema general— porque una regla a medio clasificar sigue
 * sirviendo, y una regla que nadie capturó no sirve de nada.
 */
export function RuleFormDialog({ rule, clients, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(rule);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StandingRuleFormValues>({
    resolver: zodResolver(standingRuleFormSchema),
    defaultValues: toDefaults(rule),
  });

  const clientId = watch("clientId");
  const topic = watch("topic");
  const critical = watch("critical");

  async function onSubmit(values: StandingRuleFormValues) {
    const payload = {
      ...values,
      detail: values.detail || undefined,
      clientId: values.clientId || undefined,
    };

    const result = isEditing
      ? await runAction(() =>
          updateStandingRuleAction({ id: rule!.id, data: payload }),
        )
      : await runAction(() => createStandingRuleAction(payload));

    if (!result.success) {
      if (
        result.field &&
        FIELDS.includes(result.field as keyof StandingRuleFormValues)
      ) {
        setError(result.field as keyof StandingRuleFormValues, {
          message: result.error,
        });
      }
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Guardado");
    setOpen(false);
    if (!isEditing) reset(toDefaults());
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEditing ? "Editar regla" : "Nueva regla"}
      description="Algo que SIEMPRE aplica y que no debería depender de que alguien se acuerde."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          id="rule-title"
          label="La regla"
          placeholder={TITLE_PLACEHOLDER}
          autoComplete="off"
          hint="Escríbela como se la dirías a alguien que llega nuevo."
          error={errors.title?.message}
          {...register("title")}
        />

        <FormSelectField id="rule-client" label="¿A qué empresa aplica?">
          <SearchSelect
            id="rule-client"
            options={clients.map((client) => ({
              value: client.id,
              label: client.name,
            }))}
            value={clientId ?? ""}
            onChange={(value) => setValue("clientId", value)}
            placeholder="Todas las empresas"
            searchPlaceholder="Buscar empresa…"
            // Vacío NO es un campo sin llenar: es "es regla de la casa".
            clearLabel="Todas las empresas"
          />
        </FormSelectField>

        <FormSelectField
          id="rule-topic"
          label="¿De qué parte del trabajo habla?"
        >
          <SearchSelect
            id="rule-topic"
            options={STANDING_RULE_TOPIC_ORDER.map((value) => ({
              value,
              label: STANDING_RULE_TOPIC_LABELS[value],
            }))}
            value={topic}
            onChange={(value) => setValue("topic", value as StandingRuleTopic)}
            placeholder="General"
            searchPlaceholder="Buscar tema…"
          />
        </FormSelectField>

        <div className="flex flex-col gap-2">
          <Label htmlFor="rule-detail">Detalles (opcional)</Label>
          <Textarea
            id="rule-detail"
            rows={3}
            placeholder="La bolsa va del lado izquierdo. El bordado lo manda el cliente, no se hace aquí."
            {...register("detail")}
          />
          <p className="text-xs text-muted-foreground">
            Las excepciones, las medidas, a quién preguntarle.
          </p>
        </div>

        {/* Crítica = se pinta en rojo y se va hasta arriba. Se explica qué
            significa porque sin explicarlo todo el mundo marca todo como
            crítico y el rojo deja de querer decir nada. */}
        <label className="flat-surface flex cursor-pointer items-start justify-between gap-3 p-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Es crítica</span>
            <span className="text-xs text-muted-foreground">
              Olvidarla cuesta una prenda rechazada. Sale en rojo y hasta
              arriba de la lista.
            </span>
          </span>
          <Switch
            checked={critical}
            onCheckedChange={(value) => setValue("critical", value)}
            aria-label="Es crítica"
          />
        </label>

        {isEditing && (
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Vigente</span>
              <span className="text-xs text-muted-foreground">
                Apágala si dejó de aplicar. No se borra: queda para consultar
                por qué antes se hacía así.
              </span>
            </span>
            <Switch
              checked={watch("active")}
              onCheckedChange={(value) => setValue("active", value)}
              aria-label="Vigente"
            />
          </label>
        )}

        <SubmitButton
          isSubmitting={isSubmitting}
          pendingLabel="Guardando…"
          className="w-full"
        >
          {isEditing ? "Guardar cambios" : "Registrar regla"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(rule?: StandingRuleWithClient): StandingRuleFormValues {
  return {
    title: rule?.title ?? "",
    detail: rule?.detail ?? "",
    clientId: rule?.clientId ?? "",
    topic: rule?.topic ?? "GENERAL",
    critical: rule?.critical ?? false,
    active: rule?.active ?? true,
  };
}
