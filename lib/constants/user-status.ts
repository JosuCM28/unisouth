/**
 * Estado de una cuenta, derivado de TRES banderas de la base.
 *
 * `active`, `banned` y `deletedAt` no son intercambiables y cada una la
 * revisa alguien distinto:
 *
 *  · `banned`    lo revisa BetterAuth al CREAR la sesión, así que es la única
 *                que impide iniciar sesión.
 *  · `active`    la revisa `getCurrentUser()` en cada petición de la app.
 *  · `deletedAt` es la baja lógica: el usuario desaparece de la operación
 *                pero sus rollos, movimientos y firmas siguen apuntándole.
 *
 * Tres banderas para dos preguntas ("¿puede entrar?" y "¿sigue en la
 * plantilla?") es una receta para que alguien las deje desincronizadas. Por
 * eso nadie las lee sueltas: se leen a través de esta función, y sólo
 * `UserService` las escribe, siempre juntas.
 */
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

/** Lo mínimo que hace falta para saber en qué estado está una cuenta. */
export interface AccountFlags {
  active: boolean;
  banned: boolean;
  deletedAt: Date | null;
}

export function userStatus(user: AccountFlags): UserStatus {
  // La baja gana: alguien dado de baja está suspendido también, y mostrar
  // "Suspendido" en vez de "Dado de baja" haría creer que se reactiva solo.
  if (user.deletedAt) return "DELETED";
  if (!user.active || user.banned) return "SUSPENDED";
  return "ACTIVE";
}

export function canSignIn(user: AccountFlags): boolean {
  return userStatus(user) === "ACTIVE";
}
