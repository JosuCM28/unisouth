"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { UserRow } from "@/lib/repositories/user.repository";
import {
  MIN_PASSWORD_LENGTH,
  passwordFormSchema,
  type PasswordFormValues,
} from "@/lib/validations/user.schema";
import { resetUserPasswordAction } from "@/app/actions/user.actions";
import { runAction } from "@/lib/offline/run-action";
import { FormField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  user: UserRow;
  /** El administrador cambiándose la contraseña a sí mismo. */
  isSelf: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Contraseña nueva impuesta por el administrador.
 *
 * No se pide la anterior: el punto de esta pantalla es rescatar a quien la
 * olvidó, y si hubiera que saberla no serviría de nada.
 */
export function UserPasswordDialog({
  user,
  isSelf,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: "", reason: "" },
  });

  // La contraseña tecleada no se queda en memoria entre aperturas.
  useEffect(() => {
    if (open) reset({ password: "", reason: "" });
  }, [open, reset]);

  async function onSubmit(values: PasswordFormValues) {
    const result = await runAction(() =>
      resetUserPasswordAction({ id: user.id, ...values }),
    );

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Contraseña cambiada");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Contraseña de ${user.name}`}
      description="Anótala y dásela en persona: el sistema no manda correos."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Se avisa ANTES: el administrador tiene que saber si la persona va
            a quedar fuera de su equipo antes de picarle, no después. */}
        {isSelf ? (
          <Alert>
            <AlertDescription>
              Es tu propia cuenta: tus sesiones abiertas siguen abiertas. La
              contraseña nueva la necesitarás la próxima vez que entres.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertDescription>
              Se cerrarán las sesiones abiertas de {user.name} en todos sus
              equipos y tendrá que entrar con la contraseña nueva.
            </AlertDescription>
          </Alert>
        )}

        <FormField
          id="password-new"
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
          error={errors.password?.message}
          {...register("password")}
        />

        <FormField
          id="password-reason"
          label="Motivo"
          placeholder="La olvidó y no puede entrar"
          hint="Queda en la auditoría. Es obligatorio."
          error={errors.reason?.message}
          {...register("reason")}
        />

        <SubmitButton
          isSubmitting={isSubmitting}
          pendingLabel="Cambiando…"
          className="w-full"
        >
          Cambiar contraseña
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}
