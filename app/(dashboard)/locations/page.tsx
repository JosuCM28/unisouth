import { Suspense } from "react";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { LocationRepository } from "@/lib/repositories/location.repository";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { LocationFormDialog } from "@/components/locations/location-form-dialog";
import { LocationList } from "@/components/locations/location-list";
import { WarehouseMap } from "@/components/locations/warehouse-map";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Ubicaciones",
};

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function LocationsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ubicaciones"
        description="Filas, racks y estantes de la bodega"
        action={
          <LocationFormDialog
            trigger={
              <Button className="touch-target">
                <Plus className="size-4" aria-hidden />
                Nueva
              </Button>
            }
          />
        }
      />

      <SearchInput
        placeholder="Buscar por código o nombre…"
        className="max-w-sm"
      />

      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <MapSection />
      </Suspense>

      <Suspense key={q} fallback={<ListSkeleton />}>
        <ListSection search={q} />
      </Suspense>
    </div>
  );
}

/** El mapa siempre muestra la bodega completa, sin filtrar por la búsqueda. */
async function MapSection() {
  const locations = await new LocationRepository().findAllWithLotCount();
  return <WarehouseMap locations={locations} />;
}

async function ListSection({ search }: { search?: string }) {
  const repository = new LocationRepository();
  const term = search?.trim();

  // El conteo de rollos viene de findAllWithLotCount; la búsqueda, de search().
  // Se cruzan por id para no repetir el _count en dos consultas distintas.
  const [withCount, filtered, parents] = await Promise.all([
    repository.findAllWithLotCount(),
    term ? repository.search({ search: term, pageSize: 100 }) : null,
    repository.findOptions(),
  ]);

  const matchedIds = filtered
    ? new Set(filtered.items.map((location) => location.id))
    : null;

  const locations = matchedIds
    ? withCount.filter((location) => matchedIds.has(location.id))
    : withCount;

  return (
    <LocationList
      locations={locations}
      parents={parents}
      isFiltered={Boolean(term)}
    />
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}
