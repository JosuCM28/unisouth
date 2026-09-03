import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { GarmentRepository } from "@/lib/repositories/garment.repository";
import { PageHeader } from "@/components/layout/page-header";
import { GarmentPhoto } from "@/components/garments/garment-photo";
import { PhotoViewer } from "@/components/garments/photo-viewer";
import { PlacementList } from "@/components/garments/placement-list";
import { PlacementFormDialog } from "@/components/garments/placement-form-dialog";
import { GarmentFormDialog } from "@/components/garments/garment-form-dialog";
import { GarmentDeleteButton } from "@/components/garments/garment-delete-button";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const garment = await prisma.garment.findUnique({
    where: { id },
    select: { name: true },
  });

  return { title: garment?.name ?? "Prenda" };
}

/**
 * La ficha de una prenda: la foto completa y dónde va cada marcado.
 *
 * Es la pantalla que el taller abre con el teléfono delante de la prenda, así
 * que la foto grande va arriba y la lista debajo, sin nada en medio.
 */
export default async function GarmentPage({ params }: PageProps) {
  await requirePermission("inventory:browse");

  const { id } = await params;

  const user = await getCurrentUser();
  const canWrite = user ? roleHasPermission(user.role, "catalog:write") : false;

  const garment = await new GarmentRepository().findWithPlacements(id);
  if (!garment) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/garments/folders/${garment.folder.id}`}
        className="touch-target flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {garment.folder.name}
      </Link>

      <PageHeader
        title={garment.name}
        description={garment.reference ?? garment.folder.client?.name ?? undefined}
        action={
          canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <GarmentFormDialog
                folderId={garment.folder.id}
                garment={{
                  id: garment.id,
                  name: garment.name,
                  reference: garment.reference,
                  notes: garment.notes,
                  photoId: garment.photoId,
                }}
                trigger={
                  <Button variant="outline" className="touch-target">
                    <Pencil className="size-4" aria-hidden />
                    Editar
                  </Button>
                }
              />

              <GarmentDeleteButton
                target="garment"
                id={garment.id}
                name={garment.name}
                redirectTo={`/garments/folders/${garment.folder.id}`}
                trigger={
                  <Button variant="ghost" size="icon" className="touch-target">
                    <Trash2 className="size-4" aria-hidden />
                    <span className="sr-only">Borrar la prenda</span>
                  </Button>
                }
              />
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="flex flex-col gap-3">
          <PhotoViewer photoId={garment.photoId} title={garment.name}>
            <GarmentPhoto
              photoId={garment.photoId}
              alt={garment.name}
              className="aspect-square w-full"
            />
          </PhotoViewer>

          {garment.notes && (
            <p className="flat-surface whitespace-pre-wrap p-3 text-sm text-muted-foreground">
              {garment.notes}
            </p>
          )}
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">
              Marcados
              <span className="tabular ml-2 text-muted-foreground">
                {garment.placements.length}
              </span>
            </h2>

            {canWrite && (
              <PlacementFormDialog
                garmentId={garment.id}
                trigger={
                  <Button className="touch-target">
                    <Plus className="size-4" aria-hidden />
                    Agregar
                  </Button>
                }
              />
            )}
          </div>

          <PlacementList
            garmentId={garment.id}
            placements={garment.placements}
            canWrite={canWrite}
          />
        </section>
      </div>
    </div>
  );
}
