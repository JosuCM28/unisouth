"use server";

import { auth } from "@/lib/auth";
import { AuditService } from "@/lib/core/audit.service";
import { checkRateLimit, getClientIp, LOGIN_LIMIT } from "@/lib/core/rate-limit";
import { fail, ok, type ActionResult } from "@/lib/core/result";
import { loginSchema } from "@/lib/validations/auth";

/**
 * Inicio de sesión con límite de intentos.
 *
 * No usa `executeAction` porque ésta es la única action que corre SIN sesión:
 * exigir un permiso aquí impediría entrar. Reimplementa lo mínimo —límite,
 * validación, traducción de errores— y nada más.
 */
export async function loginAction(input: unknown): Promise<ActionResult<null>> {
  const ip = await getClientIp();

  // El límite se cuenta por IP: 8 intentos cada 5 minutos. Un humano que
  // olvidó su contraseña no llega ahí; un script sí, y ahí se frena.
  const limit = checkRateLimit(`login:${ip}`, LOGIN_LIMIT);

  if (!limit.allowed) {
    await recordFailure(ip, "Bloqueado por demasiados intentos");

    return fail(
      `Demasiados intentos fallidos. Espera ${limit.retryAfterSeconds} segundos.`,
      "RATE_LIMITED",
    );
  }

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Datos inválidos",
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.path.join("."),
    );
  }

  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      // Necesario para que BetterAuth escriba la cookie de sesión.
      headers: await buildHeaders(),
    });

    return ok(null, "Bienvenido");
  } catch {
    await recordFailure(ip, `Credenciales incorrectas para ${parsed.data.email}`);

    // Mensaje deliberadamente vago: decir "ese correo no existe" le confirma
    // a un extraño qué cuentas están dadas de alta.
    return fail("Correo o contraseña incorrectos.", "INVALID_CREDENTIALS");
  }
}

/**
 * Deja constancia del intento fallido.
 *
 * Sin esto, un ataque de fuerza bruta no dejaría rastro: el administrador
 * vería la cuenta comprometida sin saber desde cuándo la estaban probando.
 */
async function recordFailure(ip: string, reason: string): Promise<void> {
  try {
    await new AuditService({ ip, source: "login" }).record({
      entity: "Auth",
      action: "LOGIN_FAILED",
      sensitivity: "MEDIUM",
      reason,
    });
  } catch {
    // Que falle la bitácora no debe tumbar el login.
  }
}

async function buildHeaders(): Promise<Headers> {
  const { headers } = await import("next/headers");
  return new Headers(await headers());
}
