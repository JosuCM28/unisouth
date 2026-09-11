"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { UserRow } from "@/lib/repositories/user.repository";
import {
  reasonFormSchema,
  type ReasonFormValues,
} from "@/lib/validations/user.schema";
import type { ActionResult } from "@/lib/core/result";
import {
  removeUserAction,
  restoreUserAction,
  setUserSuspendedAction,
} from "@/app/actions/user.actions";
import { runAction } from "@/lib/offline/run-action";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";

/** Las cuatro operaciones que cambian el acceso de alguien. */
export type StatusOperation =
  | "SUSPEND"
  | "REACTIVATE"
  | "REMOVE"
  | "RESTORE";

interface Copy {
  title: (name: string) => string;
  description: string;
  placeholder: string;
  submit: string;
  pending: string;
  done: (name: string) => string;
  destructive?: boolean;
}

/**
 * Los textos de cada operación, en un diccionario.
 *
 * Cuatro operaciones que comparten formulario —un motivo y un botón— pero
 * dicen cosas distintas. Un diccionario en vez de ternarias encadenadas
 * dentro del JSX, que es lo que prohíbe el contrato.
 */
const COPY: Record<StatusOperation, Copy> = {
  SUSPEND: {
    title: (name) => `¿Suspender a ${name}?`,
    description:
      "Deja de poder entrar de inmediato y se le cierran las sesiones abiertas. Sus rollos, movimientos y firmas se conservan intactos.",
    placeholder: "Incapacidad médica desde hoy",
    submit: "Suspender",
    pending: "Suspendiendo…",
    done: (name) => `${name} quedó suspendido`,
    destructive: true,
  },
  REACTIVATE: {
    title: (name) => `¿Quitarle la suspensión a ${name}?`,
    description: "Vuelve a poder entrar con la misma contraseña y el mismo rol.",
    placeholder: "Se reincorporó",
    submit: "Quitar suspensión",
    pending: "Reactivando…",
    done: (name) => `${name} puede volver a entrar`,
  },
  REMOVE: {
    title: (name) => `¿Dar de baja a ${name}?`,
    description:
      "Sale de la lista y deja de poder entrar. NO se borra: sus rollos, movimientos y firmas lo siguen nombrando, y se le puede reactivar después desde el filtro “Dados de baja”.",
    placeholder: "Renunció el 30 de septiembre",
    submit: "Dar de baja",
    pending: "Dando de baja…",
    done: (name) => `${name} quedó dado de baja`,
    destructive: true,
  },
  RESTORE: {
    title: (name) => `¿Reactivar a ${name}?`,
    description:
      "Vuelve a la lista con su rol y su historial. Si no recuerda su contraseña, cámbiasela después desde el menú de la fila.",
    placeholder: "Regresó a la plantilla",
    submit: "Reactivar",
    pending: "Reactivando…",
    done: (name) => `${name} quedó reactivado`,
  },
};

interface Props {
  user: UserRow;
  /** `null` = cerrado. Cuál sea determina qué se dice y qué action corre. */
  operation: StatusOperation | null;
  onClose: () => void;
}

export function UserStatusDialog({ user, operation, onClose }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReasonFormValues>({
    resolver: zodResolver(reasonFormSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (operation) reset({ reason: "" });
  }, [operation, reset]);

  if (!operation) return null;

  const copy = COPY[operation];

  async function onSubmit(values: ReasonFormValues) {
    const result = await runAction(() => run(operation!, user.id, values.reason));

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(copy.done(user.name));
    onClose();
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={copy.title(user.name)}
      description={copy.description}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          id="status-reason"
          label="Motivo"
          placeholder={copy.placeholder}
          hint="Queda en la auditoría. Es obligatorio."
          error={errors.reason?.message}
          {...register("reason")}
        />

        <SubmitButton
          isSubmitting={isSubmitting}
          pendingLabel={copy.pending}
          variant={copy.destructive ? "destructive" : "default"}
          className="w-full"
        >
          {copy.submit}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

/** Cada operación a su action. Un mapa, no una cadena de ternarias. */
function run(
  operation: StatusOperation,
  id: string,
  reason: string,
): Promise<ActionResult<unknown>> {
  if (operation === "SUSPEND") {
    return setUserSuspendedAction({ id, suspended: true, reason });
  }
  if (operation === "REACTIVATE") {
    return setUserSuspendedAction({ id, suspended: false, reason });
  }
  if (operation === "REMOVE") {
    return removeUserAction({ id, reason });
  }
  return restoreUserAction({ id, reason });
}
