import { Suspense } from "react";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { LocationRepository } from "@/lib/repositories/location.repository";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { WarehouseRepository } from "@/lib/repositories/warehouse.repository";
import { LocationFormDialog } from "@/components/locations/location-form-dialog";
import { LocationList } from "@/components/locations/location-list";
import { WarehouseMap } from "@/components/locations/warehouse-map";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/lib/core/session";

export const metadata: Metadata = {
  title: "Ubicaciones",
};

const PAGE_SIZE = 50;
/** Los mismos que ofrece el selector de la tabla. */
const PAGE_SIZES = [10, 25, 50, 100];

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; all?: string; filas?: string }>;
}

export default async function LocationsPage({ searchParams }: PageProps) {
  /* Dirección no recorre el almacén: sin `inventory:browse` esta pantalla
     no está en su menú, y ésta es la línea que de verdad la cierra —el
     enlace oculto es comodidad visual, no seguridad. */
  await requirePermission("inventory:browse");

  const params = await searchParams;
  const warehouses = await new WarehouseRepository().findOptions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ubicaciones"
        description="Filas, racks y estantes de la bodega"
        action={
          <LocationFormDialog
            warehouses={warehouses}
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

      <Suspense key={JSON.stringify(params)} fallback={<ListSkeleton />}>
        <ListSection params={params} />
      </Suspense>
    </div>
  );
}

/** El mapa siempre muestra la bodega completa, sin filtrar por la búsqueda. */
async function MapSection() {
  const locations = await new LocationRepository().findAllWithLotCount();
  return <WarehouseMap locations={locations} />;
}

async function ListSection({
  params,
}: {
  params: Awaited<PageProps["searchParams"]>;
}) {
  const repository = new LocationRepository();
  const term = params.q?.trim();
  const page = parsePositiveInt(params.page) ?? 1;
  /* Se acota a los tamaños del selector: cualquier otro valor en la URL se
     ignora en vez de dejar que alguien pida 100 000 filas a mano. */
  const pageSize = PAGE_SIZES.includes(Number(params.filas))
    ? Number(params.filas)
    : PAGE_SIZE;

  // Una sola consulta trae la página con su conteo de rollos. Antes se traía
  // la bodega COMPLETA y se cruzaba en memoria con la búsqueda: con miles de
  // ubicaciones eso significa bajarlas todas en cada visita.
  const [result, parents, warehouses] = await Promise.all([
    repository.searchWithLotCount({ search: term, page, pageSize, accumulate: params.all === "1" }),
    repository.findOptions(),
    new WarehouseRepository().findOptions(),
  ]);

  return (
    <LocationList
      locations={result.items}
      parents={parents}
      warehouses={warehouses}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      pageSize={result.pageSize}
      isFiltered={Boolean(term)}
    />
  );
}

/** Entero positivo o nada. Cualquier basura en la URL se ignora. */
function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
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
