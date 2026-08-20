import { z } from "zod";
import { TaskStatus } from "@prisma/client";
import { BOARD_COLORS } from "@/lib/constants/board-colors";
import { cuidSchema, optionalText, requiredText } from "./common";

const colorSchema = z
  .enum(BOARD_COLORS.map((color) => color.key) as [string, ...string[]])
  .default("slate");

/**
 * Un objetivo del almacén.
 *
 * Sólo el título es obligatorio: si anotar una meta cuesta más que apuntarla
 * en un papel, el tablero se queda vacío y se vuelve a la libreta.
 */
export const goalSchema = z.object({
  title: requiredText("El objetivo", 160),
  detail: optionalText,
  color: colorSchema,
});

export type GoalInput = z.infer<typeof goalSchema>;

/** Una tarjeta del kanban: un pedido que preparar, un pendiente. */
export const taskSchema = z.object({
  title: requiredText("La tarea", 160),
  detail: optionalText,
  color: colorSchema,
  // Texto libre a propósito: "Ternium", "pedido 4410". No hay catálogo detrás
  // porque el tablero es una guía personal, no un proceso controlado.
  tag: optionalText,
  status: z.nativeEnum(TaskStatus).default("PENDING"),
});

export type TaskInput = z.infer<typeof taskSchema>;

export const updateGoalSchema = z.object({ id: cuidSchema, data: goalSchema });
export const updateTaskSchema = z.object({ id: cuidSchema, data: taskSchema });

export const toggleGoalSchema = z.object({
  id: cuidSchema,
  done: z.boolean(),
});

/**
 * El resultado de arrastrar una tarjeta.
 *
 * Llega la columna destino y el orden COMPLETO de esa columna, no sólo "esta
 * tarjeta va en la posición 3": si se mandara la posición suelta, dos
 * arrastres seguidos desde dos pestañas dejarían posiciones repetidas y el
 * tablero se reordenaría solo al recargar.
 */
export const moveTaskSchema = z.object({
  id: cuidSchema,
  status: z.nativeEnum(TaskStatus),
  orderedIds: z.array(cuidSchema).max(200),
});

export const reorderGoalsSchema = z.object({
  orderedIds: z.array(cuidSchema).max(200),
});

export const removeBoardItemSchema = z.object({ id: cuidSchema });
