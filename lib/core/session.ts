import { cache } from "react";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  roleHasPermission,
  toRole,
  type Permission,
  type Role,
} from "@/lib/constants/roles";
import type { AuditContext } from "./audit.service";
import { ForbiddenError, UnauthorizedError } from "./errors";

/** El usuario que la app necesita conocer. Sin hashes ni datos de sesión. */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  image: string | null;
}

/**
 * Nombre de la cookie de sesión de BetterAuth. En producción BetterAuth le
 * antepone `__Secure-`, así que se buscan las dos variantes.
 */
const SESSION_COOKIE = "better-auth.session_token";

/**
 * Usuario de la petición actual, o null si no hay sesión válida.
 *
 * Va envuelto en `cache` de React: en un mismo render el layout, la página y
 * varios componentes preguntan por el usuario, y sin esto cada pregunta
 * sería un viaje a la base de datos. `cache` lo resuelve una vez por petición.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const raw =
    cookieStore.get(SESSION_COOKIE)?.value ??
    cookieStore.get(`__Secure-${SESSION_COOKIE}`)?.value;

  if (!raw) return null;

  // BetterAuth firma la cookie como `token.firma`; en la tabla vive el token.
  const token = raw.split(".")[0];
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          image: true,
          banned: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) return null;

  const { user } = session;
  // Dar de baja o bloquear a alguien debe surtir efecto de inmediato, sin
  // esperar a que expire la sesión que ya tenía abierta.
  if (!user.active || user.banned || user.deletedAt) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: toRole(user.role),
    active: user.active,
    image: user.image,
  };
});

/** Exige sesión activa. Úsalo cuando la página no tiene sentido sin usuario. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Exige una capacidad concreta.
 *
 * Ésta es la autorización REAL. El middleware sólo hace una redirección
 * optimista mirando la cookie; nunca es la barrera de seguridad.
 */
export async function requirePermission(
  permission: Permission,
): Promise<CurrentUser> {
  const user = await requireUser();

  if (!roleHasPermission(user.role, permission)) {
    throw new ForbiddenError(
      "No tienes permiso para realizar esta acción. Consulta al administrador.",
    );
  }

  return user;
}

/**
 * Arma el contexto de auditoría con el rastro de la petición.
 *
 * La IP viene de las cabeceras del proxy: Dokploy va detrás de un reverse
 * proxy, así que `x-forwarded-for` trae la cadena de saltos y el primero es
 * el cliente real.
 */
export async function buildAuditContext(
  user?: CurrentUser | null,
): Promise<AuditContext> {
  const headerList = await headers();

  const forwarded = headerList.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    undefined;

  const userAgent = headerList.get("user-agent") ?? undefined;

  return {
    userId: user?.id,
    userName: user?.name,
    ip,
    userAgent,
    // Distingue capturas del piso (celular) de trabajo de escritorio.
    source: isMobile(userAgent) ? "movil" : "web",
  };
}

function isMobile(userAgent?: string): boolean {
  if (!userAgent) return false;
  return /Android|iPhone|iPad|Mobile/i.test(userAgent);
}
