import { Suspense } from "react";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { MaterialRepository } from "@/lib/repositories/material.repository";
import { toPlainObject } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ExportButton } from "@/components/shared/export-button";
import { SearchInput } from "@/components/shared/search-input";
import { MaterialFormDialog } from "@/components/materials/material-form-dialog";
import { MaterialList } from "@/components/materials/material-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Materiales" };

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function MaterialsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Materiales"
        description="Telas e insumos del almacén"
        action={
          <MaterialFormDialog
            trigger={
              <Button className="touch-target">
                <Plus className="size-4" aria-hidden />
                Nuevo
              </Button>
            }
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Buscar por código, nombre o color…"
          className="flex-1 md:max-w-sm"
        />
        <ExportButton href="/api/export/materials" label="Excel" />
      </div>

      <Suspense key={q} fallback={<ListSkeleton />}>
        <ListSection search={q} />
      </Suspense>
    </div>
  );
}

async function ListSection({ search }: { search?: string }) {
  const repository = new MaterialRepository();
  const { items } = await repository.search({ search, pageSize: 100 });

  // La existencia se resuelve con groupBy en la base, no trayendo los lotes.
  const stock = await repository.getStockByMaterial(items.map((m) => m.id));

  return (
    <MaterialList
      // Material trae 9 columnas Decimal y el menú de acciones es cliente.
      materials={toPlainObject(items)}
      stock={stock}
      isFiltered={Boolean(search?.trim())}
    />
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}
