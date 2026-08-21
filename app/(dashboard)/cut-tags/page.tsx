import type { Metadata } from "next";
import { Plus, Tag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CutTagFormDialog } from "@/components/cut-tags/cut-tag-form-dialog";
import { CutTagActions } from "@/components/cut-tags/cut-tag-actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Foleos" };

/**
 * Catálogo de foleos: los papelitos de color que se engrapan a los bultos.
 *
 * Son un catálogo y no una lista fija en el código porque en el piso se acaba
 * un color y se compra otro; agregarlo no debería requerir un despliegue.
 *
 * No se pagina: son una docena de colores y van a seguir siendo una docena.
 */
export default async function CutTagsPage() {
  // Leer catálogos va con inventory:read, igual que tallas y materiales.
  await requirePermission("inventory:browse");

  const tags = await prisma.cutTagOption.findMany({
    where: { deletedAt: null },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { cutLines: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Foleos"
        description="Los colores con los que se marcan los bultos"
        action={
          <CutTagFormDialog
            trigger={
              <Button className="touch-target">
                <Plus className="size-4" aria-hidden />
                Nuevo
              </Button>
            }
          />
        }
      />

      {tags.length === 0 ? (
        <div className="flat-surface">
          <EmptyState
            icon={Tag}
            title="Aún no hay foleos"
            description="Da de alta el primer color con el botón de arriba."
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flat-surface flex items-center gap-3 p-3"
            >
              {/* La muestra grande: el color es el dato, no el nombre. */}
              <span
                className="size-10 shrink-0 border border-border"
                style={{ backgroundColor: tag.color }}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{tag.name}</p>
                <p className="tabular text-xs text-muted-foreground">
                  {tag.color}
                  {tag._count.cutLines > 0 &&
                    ` · usado en ${tag._count.cutLines} ${
                      tag._count.cutLines === 1 ? "renglón" : "renglones"
                    }`}
                </p>
              </div>

              <CutTagActions
                tag={{
                  id: tag.id,
                  name: tag.name,
                  color: tag.color,
                  order: tag.order,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
