"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Task, TaskStatus } from "@prisma/client";
import {
  createTaskAction,
  moveTaskAction,
  removeTaskAction,
  updateTaskAction,
} from "@/app/actions/board.actions";
import { TASK_STATUS_LABELS } from "@/lib/constants/labels";
import type { BoardColor } from "@/lib/constants/board-colors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BoardItemDialog, type BoardItemDraft } from "./board-item-dialog";
import { TaskCard } from "./task-card";

const COLUMNS: TaskStatus[] = ["PENDING", "IN_PROGRESS", "DONE"];

/**
 * El kanban de pendientes.
 *
 * El estado de las tarjetas vive AQUÍ y no sólo en el servidor: al soltar una
 * tarjeta se reacomoda al instante y la acción se manda después. Esperar la
 * respuesta del servidor para pintar el cambio haría que la tarjeta regresara
 * a su sitio por medio segundo con el WiFi de la bodega, y se sentiría rota.
 */
export function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const [items, setItems] = useState(tasks);
  const [dragging, setDragging] = useState<Task | null>(null);
  const [creatingIn, setCreatingIn] = useState<TaskStatus | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);

  /* Cuando el servidor revalida tras guardar, la prop trae la verdad y se
     adopta para no quedarse con el optimista.

     Se sincroniza DURANTE el render, comparando contra la prop anterior, y no
     con un `useEffect` que llame a setState: ese patrón provoca un render de
     más con los datos viejos ya pintados —la tarjeta parpadea de vuelta a su
     sitio— y es justo lo que React desaconseja. */
  const [lastTasks, setLastTasks] = useState(tasks);

  if (lastTasks !== tasks) {
    setLastTasks(tasks);
    setItems(tasks);
  }

  const sensors = useSensors(
    // Se exige recorrer 8px antes de arrastrar: sin esto, un toque para
    // editar se interpretaría como arrastre y la tarjeta saltaría sola.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // En celular se pide mantener 200ms, que distingue arrastrar de scrollear.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const byColumn = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const column of COLUMNS) {
      map.set(
        column,
        items
          .filter((task) => task.status === column)
          .sort((a, b) => a.position - b.position),
      );
    }
    return map;
  }, [items]);

  function handleDragStart(event: DragStartEvent) {
    setDragging(items.find((task) => task.id === event.active.id) ?? null);
  }

  /**
   * Resuelve dónde cayó la tarjeta.
   *
   * El destino puede ser otra TARJETA (se inserta en su lugar) o la COLUMNA
   * vacía (se va al final). Sin el segundo caso no habría forma de mover algo
   * a una columna que se quedó sin tarjetas.
   */
  function resolveTarget(
    overId: string,
  ): { status: TaskStatus; index: number } | null {
    if (COLUMNS.includes(overId as TaskStatus)) {
      const status = overId as TaskStatus;
      return { status, index: (byColumn.get(status) ?? []).length };
    }

    const over = items.find((task) => task.id === overId);
    if (!over) return null;

    const column = byColumn.get(over.status) ?? [];
    return {
      status: over.status,
      index: column.findIndex((task) => task.id === overId),
    };
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDragging(null);

    const { active, over } = event;
    if (!over) return;

    const task = items.find((item) => item.id === active.id);
    const target = resolveTarget(String(over.id));
    if (!task || !target) return;

    const currentIndex = (byColumn.get(task.status) ?? []).findIndex(
      (item) => item.id === task.id,
    );

    // Soltar donde ya estaba no debe costar un viaje al servidor.
    if (task.status === target.status && currentIndex === target.index) return;

    // Se arma la columna destino ya sin la tarjeta, y se inserta en su lugar.
    const destination = (byColumn.get(target.status) ?? []).filter(
      (item) => item.id !== task.id,
    );
    destination.splice(target.index, 0, { ...task, status: target.status });

    const orderedIds = destination.map((item) => item.id);

    // Optimista: se pinta ya, se confirma después.
    setItems((current) =>
      current.map((item) => {
        const position = orderedIds.indexOf(item.id);
        if (item.id === task.id) {
          return { ...item, status: target.status, position };
        }
        return position >= 0 ? { ...item, position } : item;
      }),
    );

    const result = await moveTaskAction({
      id: task.id,
      status: target.status,
      orderedIds,
    });

    if (!result.success) {
      toast.error(result.error);
      // Se devuelve a como estaba: dejar el optimista mentiría sobre lo que
      // quedó guardado.
      setItems(tasks);
    }
  }

  async function handleCreate(draft: BoardItemDraft) {
    const result = await createTaskAction({
      title: draft.title,
      detail: draft.detail || undefined,
      tag: draft.tag || undefined,
      color: draft.color,
      status: creatingIn ?? "PENDING",
    });

    if (!result.success) {
      toast.error(result.error);
      return false;
    }

    setCreatingIn(null);
    return true;
  }

  async function handleUpdate(draft: BoardItemDraft) {
    if (!editing) return false;

    const result = await updateTaskAction({
      id: editing.id,
      data: {
        title: draft.title,
        detail: draft.detail || undefined,
        tag: draft.tag || undefined,
        color: draft.color,
        status: editing.status,
      },
    });

    if (!result.success) {
      toast.error(result.error);
      return false;
    }

    setEditing(null);
    return true;
  }

  async function handleRemove(task: Task) {
    const result = await removeTaskAction({ id: task.id });
    if (!result.success) toast.error(result.error);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Tres columnas en escritorio; en celular se apilan y se recorren
          verticalmente, que es como se lee un pizarrón con una mano. */}
      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map((column) => (
          <Column
            key={column}
            status={column}
            tasks={byColumn.get(column) ?? []}
            onAdd={() => setCreatingIn(column)}
            onEdit={setEditing}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* La tarjeta que sigue al dedo. Sin esto sólo se ve el hueco. */}
      <DragOverlay>
        {dragging && (
          <div className="border border-foreground bg-card p-3 text-sm font-medium">
            {dragging.title}
          </div>
        )}
      </DragOverlay>

      {creatingIn && (
        <BoardItemDialog
          open
          onOpenChange={(next) => !next && setCreatingIn(null)}
          title={`Nueva tarea · ${TASK_STATUS_LABELS[creatingIn]}`}
          withTag
          onSubmit={handleCreate}
          trigger={<span />}
        />
      )}

      {editing && (
        <BoardItemDialog
          open
          onOpenChange={(next) => !next && setEditing(null)}
          title="Editar tarea"
          withTag
          initial={{
            title: editing.title,
            detail: editing.detail ?? "",
            tag: editing.tag ?? "",
            color: editing.color as BoardColor,
          }}
          onSubmit={handleUpdate}
          trigger={<span />}
        />
      )}
    </DndContext>
  );
}

interface ColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onAdd: () => void;
  onEdit: (task: Task) => void;
  onRemove: (task: Task) => void;
}

function Column({ status, tasks, onAdd, onEdit, onRemove }: ColumnProps) {
  // La columna entera es zona de suelte, para poder mover a una vacía.
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section className="flat-surface flex flex-col p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {TASK_STATUS_LABELS[status]}
          <span className="tabular ml-2 font-normal text-muted-foreground">
            {tasks.length}
          </span>
        </h3>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onAdd}
          aria-label={`Agregar a ${TASK_STATUS_LABELS[status]}`}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={cn("flex min-h-24 flex-col", isOver && "bg-accent")}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </SortableContext>

        {tasks.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">
            Arrastra aquí o toca + para agregar.
          </p>
        )}
      </div>
    </section>
  );
}
