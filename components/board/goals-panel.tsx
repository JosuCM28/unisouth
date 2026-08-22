"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Goal } from "@prisma/client";
import {
  createGoalAction,
  removeGoalAction,
  toggleGoalAction,
  updateGoalAction,
} from "@/app/actions/board.actions";
import {
  BOARD_COLOR_BAR,
  type BoardColor,
} from "@/lib/constants/board-colors";
import { cn } from "@/lib/utils";
import { runAction } from "@/lib/offline/run-action";
import { Button } from "@/components/ui/button";
import { BoardItemDialog, type BoardItemDraft } from "./board-item-dialog";

/**
 * Los objetivos del almacén: "Objetivo 1", "Objetivo 2"…
 *
 * Van arriba del kanban y en tarjetas anchas porque son pocos y se leen de
 * corrido, mientras que los pendientes son muchos y necesitan columnas.
 *
 * Tachar es un solo toque sobre la casilla: un objetivo cumplido se marca
 * decenas de veces al mes y meterlo en un diálogo lo volvería un trámite.
 */
export function GoalsPanel({ goals }: { goals: Goal[] }) {
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  function run(work: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      if (!result.success) toast.error(result.error ?? "No se pudo guardar.");
    });
  }

  async function handleCreate(draft: BoardItemDraft) {
    const result = await runAction(() => createGoalAction({
      title: draft.title,
      detail: draft.detail || undefined,
      color: draft.color,
    }));

    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    return true;
  }

  async function handleUpdate(draft: BoardItemDraft) {
    if (!editing) return false;

    const result = await runAction(() => updateGoalAction({
      id: editing.id,
      data: {
        title: draft.title,
        detail: draft.detail || undefined,
        color: draft.color,
      },
    }));

    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    setEditing(null);
    return true;
  }

  return (
    <section className="flat-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4" aria-hidden />
          Objetivos
          {goals.length > 0 && (
            <span className="tabular font-normal text-muted-foreground">
              {goals.filter((goal) => goal.done).length}/{goals.length}
            </span>
          )}
        </h2>

        <BoardItemDialog
          open={creating}
          onOpenChange={setCreating}
          title="Nuevo objetivo"
          onSubmit={handleCreate}
          trigger={
            <Button type="button" variant="outline" className="touch-target">
              <Plus className="size-4" aria-hidden />
              Agregar
            </Button>
          }
        />
      </div>

      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay objetivos. Agrega el primero para tener a la vista lo que
          se quiere lograr.
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <li
              key={goal.id}
              className="flex items-start gap-0 overflow-hidden border border-border bg-card"
            >
              {/* La franja de color es lo que se ve de reojo al pasar. */}
              <span
                className={cn(
                  "w-1 shrink-0 self-stretch",
                  BOARD_COLOR_BAR[goal.color as BoardColor] ??
                    BOARD_COLOR_BAR.slate,
                )}
                aria-hidden
              />

              <div className="flex min-w-0 flex-1 items-start gap-2 p-3">
                <button
                  type="button"
                  onClick={() =>
                    run(() =>
                      toggleGoalAction({ id: goal.id, done: !goal.done }),
                    )
                  }
                  disabled={isPending}
                  aria-pressed={goal.done}
                  aria-label={
                    goal.done ? `Destachar ${goal.title}` : `Tachar ${goal.title}`
                  }
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                    goal.done
                      ? "border-state-available bg-state-available"
                      : "border-border",
                  )}
                >
                  {goal.done && (
                    <Check className="size-3.5 text-white" aria-hidden />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      goal.done && "text-muted-foreground line-through",
                    )}
                  >
                    {goal.title}
                  </p>
                  {goal.detail && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {goal.detail}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(goal)}
                    aria-label={`Editar ${goal.title}`}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => run(() => removeGoalAction({ id: goal.id }))}
                    disabled={isPending}
                    aria-label={`Eliminar ${goal.title}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Un solo diálogo de edición para toda la lista: montar uno por
          objetivo llenaría el DOM de formularios ocultos. */}
      {editing && (
        <BoardItemDialog
          open
          onOpenChange={(next) => !next && setEditing(null)}
          title="Editar objetivo"
          initial={{
            title: editing.title,
            detail: editing.detail ?? "",
            color: editing.color as BoardColor,
          }}
          onSubmit={handleUpdate}
          trigger={<span />}
        />
      )}
    </section>
  );
}
