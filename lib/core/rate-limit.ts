import { headers } from "next/headers";
import { BusinessRuleError } from "./errors";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Límite de peticiones por ventana de tiempo.
 *
 * Vive en memoria del proceso a propósito: la alternativa seria es Redis, y
 * para una fábrica con una docena de usuarios en un solo contenedor de
 * Dokploy sería infraestructura extra sin beneficio real.
 *
 * LIMITACIÓN CONOCIDA: si algún día la app corre en varias instancias, cada
 * una llevará su propia cuenta y el límite efectivo se multiplicará. Cuando
 * eso pase, hay que cambiar este Map por Redis; la interfaz no cambia.
 */
const buckets = new Map<string, Bucket>();

/** Se limpian los vencidos de vez en cuando para que el Map no crezca solo. */
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  /** Peticiones permitidas dentro de la ventana. */
  limit: number;
  /** Tamaño de la ventana en segundos. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowSeconds * 1000 });
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: options.limit - bucket.count,
    retryAfterSeconds: 0,
  };
}

/**
 * IP del cliente detrás del proxy.
 *
 * Dokploy va tras un reverse proxy, así que la IP real es el primer salto de
 * `x-forwarded-for`. Si no viene, se usa una constante: es preferible limitar
 * a todos juntos que no limitar a nadie.
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();

  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return headerList.get("x-real-ip") ?? "desconocida";
}

/**
 * Aplica el límite y lanza si se pasó.
 *
 * El mensaje NO dice cuántos intentos quedan ni cuántos van: eso le diría a
 * quien está probando contraseñas exactamente cuándo reintentar.
 */
export async function enforceRateLimit(
  scope: string,
  options: RateLimitOptions,
): Promise<void> {
  const ip = await getClientIp();
  const result = checkRateLimit(`${scope}:${ip}`, options);

  if (!result.allowed) {
    throw new BusinessRuleError(
      `Demasiados intentos. Espera ${result.retryAfterSeconds} segundos e inténtalo de nuevo.`,
    );
  }
}

/** Escrituras: generoso para el uso normal, corta el abuso automatizado. */
export const WRITE_LIMIT: RateLimitOptions = { limit: 60, windowSeconds: 60 };

/** Login: agresivo. Es la puerta que se ataca por fuerza bruta. */
export const LOGIN_LIMIT: RateLimitOptions = { limit: 8, windowSeconds: 300 };

/** Exportaciones: son consultas pesadas que recorren tablas completas. */
export const EXPORT_LIMIT: RateLimitOptions = { limit: 10, windowSeconds: 60 };
