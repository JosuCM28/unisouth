import type { Goal, Task, TaskStatus } from "@prisma/client";
import { prisma, type PrismaExecutor } from "@/lib/prisma";

/**
 * Acceso a datos del tablero de tareas.
 *
 * No extiende `BaseRepository` a propósito: esa clase da soft delete,
 * paginación y folios, y aquí ninguno aplica. Un objetivo tachado se borra de
 * verdad —es un pizarrón, no el kárdex— y el tablero se lee entero de una
 * vez porque son decenas de tarjetas, no miles.
 */
export class BoardRepository {
  constructor(private readonly db: PrismaExecutor = prisma) {}

  /** Los objetivos en el orden en que el usuario los acomodó. */
  async goals(): Promise<Goal[]> {
    return this.db.goal.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  /** Todas las tarjetas, ya ordenadas por columna y posición. */
  async tasks(): Promise<Task[]> {
    return this.db.task.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  /**
   * Dónde va una tarjeta nueva: al FINAL de su columna.
   *
   * Se consulta el máximo en vez de contar filas: si alguna vez queda un
   * hueco en las posiciones, contar devolvería un número ya ocupado y la
   * tarjeta nueva se encimaría con otra.
   */
  async nextTaskPosition(status: TaskStatus): Promise<number> {
    const last = await this.db.task.findFirst({
      where: { status },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    return (last?.position ?? -1) + 1;
  }

  async nextGoalPosition(): Promise<number> {
    const last = await this.db.goal.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    return (last?.position ?? -1) + 1;
  }
}
