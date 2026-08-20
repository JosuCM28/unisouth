"use server";

import { executeAction } from "@/lib/core/action-handler";
import {
  goalSchema,
  moveTaskSchema,
  removeBoardItemSchema,
  reorderGoalsSchema,
  taskSchema,
  toggleGoalSchema,
  updateGoalSchema,
  updateTaskSchema,
} from "@/lib/validations/board.schema";
import { BoardService } from "@/lib/services/board.service";

const REVALIDATE = ["/tasks"];

/* El tablero es compartido: quien puede mover inventario puede anotar en él.
   Leerlo sólo pide `inventory:read`, que lo tiene cualquiera con sesión. */
const WRITE = "inventory:write" as const;

export async function createGoalAction(input: unknown) {
  return executeAction(input, {
    schema: goalSchema,
    permission: WRITE,
    revalidate: REVALIDATE,
    successMessage: "Objetivo agregado",
    handler: ({ input, auditContext }) =>
      new BoardService(auditContext).createGoal(input),
  });
}

export async function updateGoalAction(input: unknown) {
  return executeAction(input, {
    schema: updateGoalSchema,
    permission: WRITE,
    revalidate: REVALIDATE,
    successMessage: "Objetivo actualizado",
    handler: ({ input, auditContext }) =>
      new BoardService(auditContext).updateGoal(input.id, input.data),
  });
}

export async function toggleGoalAction(input: unknown) {
  return executeAction(input, {
    schema: toggleGoalSchema,
    permission: WRITE,
    revalidate: REVALIDATE,
    handler: ({ input, auditContext }) =>
      new BoardService(auditContext).toggleGoal(input.id, input.done),
  });
}

export async function removeGoalAction(input: unknown) {
  return executeAction(input, {
    schema: removeBoardItemSchema,
    permission: WRITE,
    revalidate: REVALIDATE,
    successMessage: "Objetivo eliminado",
    handler: ({ input, auditContext }) =>
      new BoardService(auditContext).removeGoal(input.id),
  });
}

export async function createTaskAction(input: unknown) {
  return executeAction(input, {
    schema: taskSchema,
    permission: WRITE,
    revalidate: REVALIDATE,
    successMessage: "Tarea agregada",
    handler: ({ input, auditContext }) =>
      new BoardService(auditContext).createTask(input),
  });
}

export async function updateTaskAction(input: unknown) {
  return executeAction(input, {
    schema: updateTaskSchema,
    permission: WRITE,
    revalidate: REVALIDATE,
    successMessage: "Tarea actualizada",
    handler: ({ input, auditContext }) =>
      new BoardService(auditContext).updateTask(input.id, input.data),
  });
}

export async function removeTaskAction(input: unknown) {
  return executeAction(input, {
    schema: removeBoardItemSchema,
    permission: WRITE,
    revalidate: REVALIDATE,
    successMessage: "Tarea eliminada",
    handler: ({ input, auditContext }) =>
      new BoardService(auditContext).removeTask(input.id),
  });
}

/* Arrastrar no lleva `successMessage`: un toast por cada tarjeta que se mueve
   taparía el tablero justo mientras se está reacomodando. */
export async function moveTaskAction(input: unknown) {
  return executeAction(input, {
    schema: moveTaskSchema,
    permission: WRITE,
    revalidate: REVALIDATE,
    handler: ({ input, auditContext }) =>
      new BoardService(auditContext).moveTask(
        input.id,
        input.status,
        input.orderedIds,
      ),
  });
}

export async function reorderGoalsAction(input: unknown) {
  return executeAction(input, {
    schema: reorderGoalsSchema,
    permission: WRITE,
    revalidate: REVALIDATE,
    handler: ({ input, auditContext }) =>
      new BoardService(auditContext).reorderGoals(input.orderedIds),
  });
}
