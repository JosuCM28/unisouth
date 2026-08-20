import type { Goal, Task, TaskStatus } from "@prisma/client";
import { NotFoundError } from "@/lib/core/errors";
import { BoardRepository } from "@/lib/repositories/board.repository";
import type { GoalInput, TaskInput } from "@/lib/validations/board.schema";
import { BaseService } from "./base.service";

/**
 * El tablero de objetivos y tareas.
 *
 * Es un pizarrón de apoyo, no un proceso del inventario: por eso NO escribe
 * en `AuditLog`. La auditoría existe para responder "quién movió esta tela";
 * llenarla con "fulano arrastró una tarjeta" ahogaría en ruido justo la
 * bitácora que se consulta cuando algo no cuadra.
 */
export class BoardService extends BaseService {
  // ── Objetivos ──

  async createGoal(input: GoalInput): Promise<Goal> {
    const repository = new BoardRepository(this.db);

    return this.db.goal.create({
      data: { ...input, position: await repository.nextGoalPosition() },
    });
  }

  async updateGoal(id: string, input: GoalInput): Promise<Goal> {
    await this.requireGoal(id);
    return this.db.goal.update({ where: { id }, data: input });
  }

  /** Tachar y destachar. Es un toque, no una edición completa. */
  async toggleGoal(id: string, done: boolean): Promise<Goal> {
    await this.requireGoal(id);
    return this.db.goal.update({ where: { id }, data: { done } });
  }

  async removeGoal(id: string): Promise<void> {
    await this.requireGoal(id);
    await this.db.goal.delete({ where: { id } });
  }

  // ── Tareas ──

  async createTask(input: TaskInput): Promise<Task> {
    const repository = new BoardRepository(this.db);

    return this.db.task.create({
      data: {
        ...input,
        position: await repository.nextTaskPosition(input.status),
      },
    });
  }

  async updateTask(id: string, input: TaskInput): Promise<Task> {
    const before = await this.requireTask(id);

    /* Si la edición cambia de columna hay que reubicarla al final de la
       nueva: conservar la posición vieja la encimaría con la tarjeta que ya
       ocupa ese lugar allá. */
    const movedColumn = before.status !== input.status;
    const position = movedColumn
      ? await new BoardRepository(this.db).nextTaskPosition(input.status)
      : before.position;

    return this.db.task.update({
      where: { id },
      data: { ...input, position },
    });
  }

  async removeTask(id: string): Promise<void> {
    await this.requireTask(id);
    await this.db.task.delete({ where: { id } });
  }

  /**
   * Reacomoda una columna completa tras arrastrar una tarjeta.
   *
   * Se reescriben TODAS las posiciones de la columna en una transacción, en
   * vez de sólo la de la tarjeta movida. Guardar una posición suelta deja
   * empates —dos tarjetas en la 3— y el orden que ve el usuario dejaría de
   * ser el que quedó guardado en cuanto recargara.
   */
  async moveTask(
    id: string,
    status: TaskStatus,
    orderedIds: string[],
  ): Promise<void> {
    await this.requireTask(id);

    await this.transaction(async (tx) => {
      await tx.task.update({ where: { id }, data: { status } });

      await Promise.all(
        orderedIds.map((taskId, index) =>
          tx.task.update({ where: { id: taskId }, data: { position: index } }),
        ),
      );
    });
  }

  async reorderGoals(orderedIds: string[]): Promise<void> {
    await this.transaction(async (tx) => {
      await Promise.all(
        orderedIds.map((goalId, index) =>
          tx.goal.update({ where: { id: goalId }, data: { position: index } }),
        ),
      );
    });
  }

  private async requireGoal(id: string): Promise<Goal> {
    const goal = await this.db.goal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundError("el objetivo");
    return goal;
  }

  private async requireTask(id: string): Promise<Task> {
    const task = await this.db.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundError("la tarea");
    return task;
  }
}
