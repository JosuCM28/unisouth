"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { Task } from "@prisma/client";
import {
  BOARD_COLOR_BAR,
  type BoardColor,
} from "@/lib/constants/board-colors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  task: Task;
  onEdit: (task: Task) => void;
  onRemove: (task: Task) => void;
}

/**
 * Una tarjeta del kanban.
 *
 * El asa de arrastre es EXPLÍCITA y no la tarjeta entera: en celular, hacer
 * arrastrable toda la tarjeta secuestra el scroll de la columna —el dedo que
 * quería bajar acaba moviendo un pendiente de lugar—. Con asa, el resto de la
 * tarjeta sigue siendo tocable y la lista se desplaza normal.
 */
export function TaskCard({ task, onEdit, onRemove }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex overflow-hidden border border-border bg-card",
        // Mientras se arrastra se atenúa para que se vea el hueco destino.
        isDragging && "opacity-40",
      )}
    >
      <span
        className={cn(
          "w-1 shrink-0",
          BOARD_COLOR_BAR[task.color as BoardColor] ?? BOARD_COLOR_BAR.slate,
        )}
        aria-hidden
      />

      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${task.title}`}
        className="touch-target flex shrink-0 cursor-grab items-center px-1 text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <div className="min-w-0 flex-1 py-2 pr-1">
        <p className="text-sm font-medium">{task.title}</p>

        {task.tag && (
          <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {task.tag}
          </span>
        )}

        {task.detail && (
          <p className="mt-1 text-xs text-muted-foreground">{task.detail}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onEdit(task)}
          aria-label={`Editar ${task.title}`}
        >
          <Pencil className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(task)}
          aria-label={`Eliminar ${task.title}`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </li>
  );
}
