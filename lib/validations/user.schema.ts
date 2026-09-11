import { z } from "zod";
import { ROLES } from "@/lib/constants/roles";
import { optionalText, requiredText } from "./common";

/**
 * Cuentas de usuario.
 *
 * Es el único formulario del sistema donde la regla de "pocos campos
 * obligatorios" no aplica del todo: un usuario sin contraseña o sin rol no es
 * un registro incompleto, es una cuenta que no sirve para nada.
 */

/** El MISMO mínimo que `emailAndPassword.minPasswordLength` en lib/auth.ts. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * El id de usuario NO usa `cuidSchema`.
 *
 * Las cuentas creadas por BetterAuth traen su propio generador de ids, que no
 * produce cuid: exigir el formato `c…` rechazaría a los usuarios que ya
 * existen en la base y la pantalla no podría ni editarlos.
 */
export const userIdSchema = z
  .string({ message: "Selecciona un usuario" })
  .trim()
  .min(1, "Selecciona un usuario")
  .max(64, "Identificador inválido");

/**
 * El correo SIEMPRE baja a minúsculas.
 *
 * BetterAuth normaliza al crear pero no al editar, así que sin esto
 * "Juan@x.com" entraría como una cuenta distinta de "juan@x.com": el índice
 * único no las ve iguales y el usuario no entendería por qué no puede entrar.
 */
const emailField = z
  .string({ message: "El correo es obligatorio" })
  .trim()
  .min(1, "El correo es obligatorio")
  .max(160, "El correo no puede pasar de 160 caracteres")
  .pipe(z.email("El correo no tiene un formato válido"))
  .transform((value) => value.toLowerCase());

const passwordField = z
  .string({ message: "La contraseña es obligatoria" })
  .min(
    MIN_PASSWORD_LENGTH,
    `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
  )
  .max(128, "La contraseña no puede pasar de 128 caracteres");

const roleField = z.enum(ROLES, { message: "Selecciona un rol" });

/**
 * Motivo obligatorio.
 *
 * Lo exige `AuditService` para todo cambio HIGH o CRITICAL, y esto es lo que
 * hace que seis meses después se pueda contestar por qué se le quitó el
 * acceso a alguien. Se valida aquí además de allá para que el formulario lo
 * marque en rojo en vez de reventar en el servidor.
 */
const reasonField = requiredText("El motivo", 300);

export const userCreateSchema = z.object({
  name: requiredText("El nombre", 120),
  email: emailField,
  password: passwordField,
  role: roleField,
  phone: optionalText,
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

/**
 * La edición NO toca ni el rol ni la contraseña.
 *
 * Van en acciones aparte porque son los dos cambios que sí exigen motivo:
 * mezclarlos con "corregir un apellido mal escrito" obligaría a pedir
 * justificación por una falta de ortografía.
 */
export const userUpdateSchema = z.object({
  id: userIdSchema,
  name: requiredText("El nombre", 120),
  email: emailField,
  phone: optionalText,
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const userRoleSchema = z.object({
  id: userIdSchema,
  role: roleField,
  reason: reasonField,
});

export type UserRoleInput = z.infer<typeof userRoleSchema>;

export const userPasswordSchema = z.object({
  id: userIdSchema,
  password: passwordField,
  reason: reasonField,
});

export type UserPasswordInput = z.infer<typeof userPasswordSchema>;

export const userSuspendSchema = z.object({
  id: userIdSchema,
  suspended: z.boolean(),
  reason: reasonField,
});

export type UserSuspendInput = z.infer<typeof userSuspendSchema>;

export const userReasonSchema = z.object({
  id: userIdSchema,
  reason: reasonField,
});

export type UserReasonInput = z.infer<typeof userReasonSchema>;

export const userIdOnlySchema = z.object({ id: userIdSchema });

// ─────────────────────────────────────────────────────────────────────────
//  Esquemas del formulario (React Hook Form)
//
//  Van aparte de los de arriba porque RHF necesita que el tipo de entrada y
//  el de salida coincidan: un `.transform()` deja el campo tipado como el
//  valor YA transformado, y el `defaultValue` del input dejaría de encajar.
// ─────────────────────────────────────────────────────────────────────────

const formEmail = z
  .string()
  .trim()
  .min(1, "El correo es obligatorio")
  .pipe(z.email("El correo no tiene un formato válido"));

/** Alta: aquí la contraseña sí es obligatoria. */
export const userCreateFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  email: formEmail,
  phone: z.string(),
  role: roleField,
  password: passwordField,
});

export type UserCreateFormValues = z.infer<typeof userCreateFormSchema>;

/**
 * Edición: sin contraseña.
 *
 * El campo ni se pinta ni se manda —no se le reescribe la contraseña a nadie
 * por corregirle el teléfono—, pero se declara como texto libre en vez de
 * opcional a propósito: así los dos esquemas producen EXACTAMENTE el mismo
 * tipo y el formulario puede intercambiar de resolver sin castear nada.
 */
export const userEditFormSchema = userCreateFormSchema.extend({
  password: z.string(),
});

export type UserFormValues = UserCreateFormValues;

export const reasonFormSchema = z.object({
  reason: z.string().trim().min(1, "Escribe el motivo").max(300),
});

export type ReasonFormValues = z.infer<typeof reasonFormSchema>;

export const passwordFormSchema = z.object({
  password: passwordField,
  reason: z.string().trim().min(1, "Escribe el motivo").max(300),
});

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export const roleFormSchema = z.object({
  role: roleField,
  reason: z.string().trim().min(1, "Escribe el motivo").max(300),
});

export type RoleFormValues = z.infer<typeof roleFormSchema>;
