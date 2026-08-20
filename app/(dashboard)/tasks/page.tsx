import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { BoardRepository } from "@/lib/repositories/board.repository";
import { PageHeader } from "@/components/layout/page-header";
import { GoalsPanel } from "@/components/board/goals-panel";
import { KanbanBoard } from "@/components/board/kanban-board";

export const metadata: Metadata = { title: "Tareas" };

/**
 * El pizarrón del almacén: objetivos arriba, pendientes abajo.
 *
 * Los objetivos van primero porque son el "para qué" —lo que se quiere lograr
 * este mes— y el kanban es el "cómo va": los pedidos y recados sueltos que
 * avanzan de columna. Leerlo de arriba abajo cuenta la historia completa.
 *
 * Server Component delgado: lee del repositorio y monta. Toda la interacción
 * —arrastrar, tachar, editar— vive en los componentes cliente.
 */
export default async function TasksPage() {
  await requirePermission("inventory:read");

  const repository = new BoardRepository();
  const [goals, tasks] = await Promise.all([
    repository.goals(),
    repository.tasks(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tareas"
        description="Tus objetivos y el tablero de pendientes"
      />

      <GoalsPanel goals={goals} />

      <KanbanBoard tasks={tasks} />
    </div>
  );
}
