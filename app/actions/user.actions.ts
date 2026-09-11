"use server";

import { executeAction } from "@/lib/core/action-handler";
import { SENSITIVE_LIMIT } from "@/lib/core/rate-limit";
import { UserService } from "@/lib/services/user.service";
import {
  userCreateSchema,
  userIdOnlySchema,
  userPasswordSchema,
  userReasonSchema,
  userRoleSchema,
  userSuspendSchema,
  userUpdateSchema,
} from "@/lib/validations/user.schema";

/**
 * Administración de usuarios.
 *
 * Todas exigen `user:manage`, que sólo trae ADMIN. Y todas llevan el límite
 * estrecho: crear cuentas y cambiar contraseñas son las acciones que a un
 * atacante con una sesión robada le interesaría repetir en ráfaga.
 */
const REVALIDATE = ["/users"];

export async function createUserAction(input: unknown) {
  return executeAction(input, {
    schema: userCreateSchema,
    permission: "user:manage",
    revalidate: REVALIDATE,
    rateLimit: SENSITIVE_LIMIT,
    successMessage: "Usuario creado",
    handler: ({ input, auditContext }) =>
      new UserService(auditContext).create(input),
  });
}

export async function updateUserAction(input: unknown) {
  return executeAction(input, {
    schema: userUpdateSchema,
    permission: "user:manage",
    revalidate: REVALIDATE,
    successMessage: "Datos actualizados",
    handler: ({ input, auditContext }) =>
      new UserService(auditContext).update(input),
  });
}

export async function changeUserRoleAction(input: unknown) {
  return executeAction(input, {
    schema: userRoleSchema,
    permission: "user:manage",
    revalidate: REVALIDATE,
    rateLimit: SENSITIVE_LIMIT,
    successMessage: "Rol actualizado",
    handler: ({ input, auditContext }) =>
      new UserService(auditContext).changeRole(input),
  });
}

export async function resetUserPasswordAction(input: unknown) {
  return executeAction(input, {
    schema: userPasswordSchema,
    permission: "user:manage",
    revalidate: REVALIDATE,
    rateLimit: SENSITIVE_LIMIT,
    successMessage: "Contraseña cambiada",
    handler: ({ input, auditContext }) =>
      new UserService(auditContext).resetPassword(input),
  });
}

export async function setUserSuspendedAction(input: unknown) {
  return executeAction(input, {
    schema: userSuspendSchema,
    permission: "user:manage",
    revalidate: REVALIDATE,
    rateLimit: SENSITIVE_LIMIT,
    handler: ({ input, auditContext }) =>
      new UserService(auditContext).setSuspended(input),
  });
}

export async function removeUserAction(input: unknown) {
  return executeAction(input, {
    schema: userReasonSchema,
    permission: "user:manage",
    revalidate: REVALIDATE,
    rateLimit: SENSITIVE_LIMIT,
    successMessage: "Usuario dado de baja",
    handler: ({ input, auditContext }) =>
      new UserService(auditContext).remove(input.id, input.reason),
  });
}

export async function restoreUserAction(input: unknown) {
  return executeAction(input, {
    schema: userReasonSchema,
    permission: "user:manage",
    revalidate: REVALIDATE,
    rateLimit: SENSITIVE_LIMIT,
    successMessage: "Usuario reactivado",
    handler: ({ input, auditContext }) =>
      new UserService(auditContext).restore(input.id, input.reason),
  });
}

export async function closeUserSessionsAction(input: unknown) {
  return executeAction(input, {
    schema: userIdOnlySchema,
    permission: "user:manage",
    revalidate: REVALIDATE,
    successMessage: "Sesiones cerradas",
    handler: ({ input, auditContext }) =>
      new UserService(auditContext).closeSessions(input.id),
  });
}
