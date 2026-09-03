import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Plus, Shirt, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { GarmentFolderRepository } from "@/lib/repositories/garment.repository";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GarmentGrid } from "@/components/garments/garment-grid";
import { GarmentFormDialog } from "@/components/garments/garment-form-dialog";
import { GarmentFolderFormDialog } from "@/components/garments/garment-folder-form-dialog";
import { GarmentDeleteButton } from "@/components/garments/garment-delete-button";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const folder = await prisma.garmentFolder.findUnique({
    where: { id },
    select: { name: true },
  });

  return { title: folder?.name ?? "Carpeta" };
}

/** Las prendas de una carpeta, como tablero de fotos. */
export default async function GarmentFolderPage({ params }: PageProps) {
  await requirePermission("inventory:browse");

  const { id } = await params;

  const user = await getCurrentUser();
  const canWrite = user ? roleHasPermission(user.role, "catalog:write") : false;

  const [folder, clients] = await Promise.all([
    new GarmentFolderRepository().findWithGarments(id),
    prisma.client.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!folder) notFound();

  const garments = folder.garments.map((garment) => ({
    id: garment.id,
    name: garment.name,
    reference: garment.reference,
    notes: garment.notes,
    photoId: garment.photoId,
    placementCount: garment._count.placements,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/garments"
        className="touch-target flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Prendas
      </Link>

      <PageHeader
        title={folder.name}
        description={folder.client?.name ?? "Sin cliente"}
        action={
          canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <GarmentFolderFormDialog
                clients={clients}
                folder={{
                  id: folder.id,
                  name: folder.name,
                  clientId: folder.clientId,
                  notes: folder.notes,
                }}
                trigger={
                  <Button variant="outline" className="touch-target">
                    <Pencil className="size-4" aria-hidden />
                    Editar
                  </Button>
                }
              />

              <GarmentDeleteButton
                target="folder"
                id={folder.id}
                name={folder.name}
                redirectTo="/garments"
                warning={
                  garments.length > 0
                    ? `Todavía tiene ${garments.length} prendas dentro. Quítalas primero.`
                    : undefined
                }
                trigger={
                  <Button variant="ghost" size="icon" className="touch-target">
                    <Trash2 className="size-4" aria-hidden />
                    <span className="sr-only">Borrar la carpeta</span>
                  </Button>
                }
              />

              <GarmentFormDialog
                folderId={folder.id}
                trigger={
                  <Button className="touch-target">
                    <Plus className="size-4" aria-hidden />
                    Nueva prenda
                  </Button>
                }
              />
            </div>
          ) : undefined
        }
      />

      {folder.notes && (
        <p className="flat-surface whitespace-pre-wrap p-3 text-sm text-muted-foreground">
          {folder.notes}
        </p>
      )}

      {garments.length === 0 ? (
        <div className="flat-surface">
          <EmptyState
            icon={Shirt}
            title="Esta carpeta está vacía"
            description="Agrega la primera prenda con su foto."
          />
        </div>
      ) : (
        <GarmentGrid
          folderId={folder.id}
          garments={garments}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}
