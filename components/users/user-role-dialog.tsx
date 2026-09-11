"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { UserRow } from "@/lib/repositories/user.repository";
import { ROLE_LABELS, ROLE_VALUES } from "@/lib/constants/roles";
import {
  roleFormSchema,
  type RoleFormValues,
} from "@/lib/validations/user.schema";
import { changeUserRoleAction } from "@/app/actions/user.actions";
import { runAction } from "@/lib/offline/run-action";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";

interface Props {
  user: UserRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cambio de rol, con motivo obligatorio.
 *
 * El motivo lo exige `AuditService` para todo cambio CRITICAL, y es lo que
 * permite contestar seis meses después por qué alguien dejó de ver la
 * auditoría o empezó a poder autorizar compras.
 */
export function UserRoleDialog({ user, open, onOpenChange }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { role: user.role, reason: "" },
  });

  /* Al reabrir el diálogo se vuelve al rol actual: si no, quedaría el que se
     alcanzó a elegir la vez anterior y se cambiaría un rol sin querer. */
  useEffect(() => {
    if (open) reset({ role: user.role, reason: "" });
  }, [open, user.role, reset]);

  async function onSubmit(values: RoleFormValues) {
    const result = await runAction(() =>
      changeUserRoleAction({ id: user.id, ...values }),
    );

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`${user.name} ahora es ${ROLE_LABELS[values.role]}`);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cambiar el rol de ${user.name}`}
      description={`Hoy es ${ROLE_LABELS[user.role]}. El rol nuevo aplica en su siguiente clic, sin tener que volver a entrar.`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormSelectField id="role-new" label="Rol nuevo" error={errors.role?.message}>
          <SearchSelect
            id="role-new"
            options={ROLE_VALUES.map((value) => ({
              value,
              label: ROLE_LABELS[value],
            }))}
            value={watch("role")}
            onChange={(value) =>
              setValue("role", value as RoleFormValues["role"], {
                shouldValidate: true,
              })
            }
            placeholder="Selecciona el rol"
            searchPlaceholder="Buscar rol…"
            emptyMessage="Sin roles"
          />
        </FormSelectField>

        <FormField
          id="role-reason"
          label="Motivo"
          placeholder="Pasa a compras a partir de octubre"
          hint="Queda en la auditoría. Es obligatorio."
          error={errors.reason?.message}
          {...register("reason")}
        />

        <SubmitButton
          isSubmitting={isSubmitting}
          pendingLabel="Cambiando…"
          className="w-full"
        >
          Cambiar rol
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}
