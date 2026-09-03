import type { Metadata } from "next";
import Link from "next/link";
import { FolderPlus, Shirt } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { GarmentFolderRepository } from "@/lib/repositories/garment.repository";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GarmentPhoto } from "@/components/garments/garment-photo";
import { GarmentFolderFormDialog } from "@/components/garments/garment-folder-form-dialog";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Prendas" };

/**
 * Las carpetas del catálogo visual: una por cliente o por línea.
 *
 * Cada tarjeta enseña la primera prenda con foto como portada. Es lo que hace
 * reconocible una carpeta de un vistazo cuando ya hay quince.
 */
export default async function GarmentsPage() {
  await requirePermission("inventory:browse");

  const user = await getCurrentUser();
  const canWrite = user ? roleHasPermission(user.role, "catalog:write") : false;

  const [folders, clients] = await Promise.all([
    new GarmentFolderRepository().findAllWithCounts(),
    prisma.client.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Prendas"
        description="Dónde va cada bordado, con foto, para que el taller no adivine"
        action={
          canWrite ? (
            <GarmentFolderFormDialog
              clients={clients}
              trigger={
                <Button className="touch-target">
                  <FolderPlus className="size-4" aria-hidden />
                  Nueva carpeta
                </Button>
              }
            />
          ) : undefined
        }
      />

      {folders.length === 0 ? (
        <div className="flat-surface">
          <EmptyState
            icon={Shirt}
            title="Aún no hay carpetas"
            description="Crea una por cliente —TAMSA— y mete dentro sus prendas."
          />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {folders.map((folder) => (
            <li key={folder.id} className="flat-surface">
              <Link
                href={`/garments/folders/${folder.id}`}
                className="flex flex-col"
              >
                <GarmentPhoto
                  photoId={folder.coverPhotoId}
                  alt={folder.name}
                  className="aspect-square w-full"
                  emptyLabel="Sin prendas"
                />

                <div className="flex flex-col gap-0.5 p-2">
                  <p className="text-sm font-medium leading-tight">
                    {folder.name}
                  </p>
                  {folder.client && (
                    <p className="truncate text-xs text-muted-foreground">
                      {folder.client.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {folder.garmentCount}{" "}
                    {folder.garmentCount === 1 ? "prenda" : "prendas"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
