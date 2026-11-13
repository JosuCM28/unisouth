import { Prisma } from "@prisma/client";

/**
 * ¿Prisma rechazó la escritura por una llave única repetida?
 *
 * Vive aparte porque la usan todas las capturas que suben del celular: es lo
 * que detecta que dos reenvíos de la MISMA captura llegaron a la vez y uno ya
 * ganó la carrera.
 */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
