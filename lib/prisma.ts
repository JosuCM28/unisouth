import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Singleton del cliente Prisma.
 *
 * En desarrollo, Next.js recarga los módulos en cada cambio (HMR). Sin este
 * patrón cada recarga crearía un PrismaClient nuevo y en pocos minutos se
 * agotaría el pool de conexiones de Neon. En producción el módulo se evalúa
 * una sola vez, así que la instancia global no hace falta.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Cliente dentro de una transacción: es el mismo PrismaClient sin los métodos
 * que no pueden anidarse ($connect, $transaction, etc.).
 */
export type PrismaTransaction = Prisma.TransactionClient;

/**
 * Cualquier cosa capaz de ejecutar consultas: el cliente normal o una
 * transacción. Los repositorios lo reciben para poder participar en la
 * transacción que abre el servicio, sin saber cuál de los dos les tocó.
 */
export type PrismaExecutor = PrismaClient | PrismaTransaction;
