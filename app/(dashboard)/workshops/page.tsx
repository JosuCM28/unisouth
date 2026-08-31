import type { Metadata } from "next";
import { Factory, Layers, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { WorkshopFormDialog } from "@/components/workshops/workshop-form-dialog";
import { ProcessStageFormDialog } from "@/components/workshops/process-stage-form-dialog";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Talleres" };

/**
 * Talleres y etapas: con quién y para qué salen las prendas ya cortadas.
 *
 * Los dos catálogos comparten pantalla porque se dan de alta juntos y una vez:
 * el día que entra un maquilador nuevo se captura el taller y, si trae un
 * proceso que no existía, la etapa. Separarlos en dos destinos del menú por
 * media docena de renglones sólo alarga el camino.
 *
 * No se paginan: son unos cuantos y van a seguir siendo unos cuantos.
 */
export default async function WorkshopsPage() {
  await requirePermission("inventory:browse");

  const [workshops, stages] = await Promise.all([
    prisma.workshop.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { shipments: true } } },
    }),
    prisma.processStage.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { shipments: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Talleres"
        description="Quién borda o arma, y por qué procesos pasa la prenda"
      />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Talleres
          </h2>
          <WorkshopFormDialog
            trigger={
              <Button variant="outline" className="touch-target">
                <Plus className="size-4" aria-hidden />
                Taller
              </Button>
            }
          />
        </div>

        {workshops.length === 0 ? (
          <div className="flat-surface">
            <EmptyState
              icon={Factory}
              title="Aún no hay talleres"
              description="Da de alta a quien borda o arma tus prendas."
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {workshops.map((workshop) => (
              <li
                key={workshop.id}
                className="flat-surface flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {workshop.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[workshop.contact, workshop.phone]
                      .filter(Boolean)
                      .join(" · ") || "Sin contacto"}
                    {` · ${workshop._count.shipments} ${workshop._count.shipments === 1 ? "envío" : "envíos"}`}
                  </p>
                </div>

                <WorkshopFormDialog
                  workshop={workshop}
                  trigger={
                    <Button variant="ghost" className="touch-target shrink-0">
                      Editar
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Etapas
          </h2>
          <ProcessStageFormDialog
            trigger={
              <Button variant="outline" className="touch-target">
                <Plus className="size-4" aria-hidden />
                Etapa
              </Button>
            }
          />
        </div>

        {stages.length === 0 ? (
          <div className="flat-surface">
            <EmptyState
              icon={Layers}
              title="Aún no hay etapas"
              description="Bordado, armado, lavado: los procesos por los que pasa la prenda."
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {stages.map((stage) => (
              <li
                key={stage.id}
                className="flat-surface flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{stage.name}</p>
                  <p className="tabular truncate text-xs text-muted-foreground">
                    {stage.code}
                    {` · ${stage._count.shipments} ${stage._count.shipments === 1 ? "envío" : "envíos"}`}
                  </p>
                </div>

                <ProcessStageFormDialog
                  stage={stage}
                  trigger={
                    <Button variant="ghost" className="touch-target shrink-0">
                      Editar
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
