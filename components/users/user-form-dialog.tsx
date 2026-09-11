"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { UserRow } from "@/lib/repositories/user.repository";
import { ROLE_LABELS, ROLE_VALUES } from "@/lib/constants/roles";
import {
  MIN_PASSWORD_LENGTH,
  userCreateFormSchema,
  userEditFormSchema,
  type UserFormValues,
} from "@/lib/validations/user.schema";
import { createUserAction, updateUserAction } from "@/app/actions/user.actions";
import { runAction } from "@/lib/offline/run-action";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";

const FIELDS: (keyof UserFormValues)[] = [
  "name",
  "email",
  "phone",
  "role",
  "password",
];

interface Props {
  user?: UserRow;
  trigger: ReactNode;
}

/**
 * Alta y edición de una cuenta.
 *
 * Al EDITAR no aparece la contraseña y el rol queda fuera del envío: son los
 * dos cambios que exigen motivo para la bitácora, y van en sus propios
 * diálogos. Mezclarlos aquí obligaría a justificar por escrito la corrección
 * de un apellido mal escrito.
 */
export function UserFormDialog({ user, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(user);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(isEditing ? userEditFormSchema : userCreateFormSchema),
    defaultValues: toDefaults(user),
  });

  async function onSubmit(values: UserFormValues) {
    const result = isEditing
      ? await runAction(() =>
          updateUserAction({
            id: user!.id,
            name: values.name,
            email: values.email,
            phone: values.phone || undefined,
          }),
        )
      : await runAction(() =>
          createUserAction({
            name: values.name,
            email: values.email,
            password: values.password,
            role: values.role,
            phone: values.phone || undefined,
          }),
        );

    if (!result.success) {
      if (result.field && FIELDS.includes(result.field as keyof UserFormValues)) {
        setError(result.field as keyof UserFormValues, { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? "Guardado");
    setOpen(false);

    // Al crear se limpia: lo normal es dar de alta a varios seguidos.
    if (!isEditing) reset(toDefaults());

    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEditing ? "Editar usuario" : "Nuevo usuario"}
      description={
        isEditing
          ? "El rol y la contraseña se cambian desde el menú de la fila."
          : "Con estos datos la persona ya puede entrar al sistema."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          id="user-name"
          label="Nombre"
          placeholder="Miguel Ángel Ruiz"
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />

        <FormField
          id="user-email"
          label="Correo"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="miguel@unisouth.mx"
          hint="Es con lo que inicia sesión."
          error={errors.email?.message}
          {...register("email")}
        />

        {!isEditing && (
          <>
            <FormSelectField
              id="user-role"
              label="Rol"
              error={errors.role?.message}
              hint="Define qué partes del sistema ve."
            >
              <SearchSelect
                id="user-role"
                options={ROLE_VALUES.map((value) => ({
                  value,
                  label: ROLE_LABELS[value],
                }))}
                value={watch("role")}
                onChange={(value) =>
                  setValue("role", value as UserFormValues["role"], {
                    shouldValidate: true,
                  })
                }
                placeholder="Selecciona el rol"
                searchPlaceholder="Buscar rol…"
                emptyMessage="Sin roles"
              />
            </FormSelectField>

            <FormField
              id="user-password"
              label="Contraseña"
              type="password"
              autoComplete="new-password"
              hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres. Dísela en persona; el sistema no manda correos.`}
              error={errors.password?.message}
              {...register("password")}
            />
          </>
        )}

        <FormSection title="Datos adicionales">
          <FormField
            id="user-phone"
            label="Teléfono"
            inputMode="tel"
            className="tabular"
            error={errors.phone?.message}
            {...register("phone")}
          />
        </FormSection>

        <SubmitButton
          isSubmitting={isSubmitting}
          pendingLabel="Guardando…"
          className="w-full"
        >
          {isEditing ? "Guardar cambios" : "Crear usuario"}
        </SubmitButton>
      </form>
    </ResponsiveFormDialog>
  );
}

function toDefaults(user?: UserRow): UserFormValues {
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    // El más limitado por omisión: si alguien le pica "crear" sin fijarse en
    // este campo, el daño es que la persona vea de menos, no de más.
    role: user?.role ?? "READ_ONLY",
    password: "",
  };
}
