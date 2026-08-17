import { Suspense } from "react";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import type { LotStatus } from "@prisma/client";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { LocationRepository } from "@/lib/repositories/location.repository";
import { LotRepository } from "@/lib/repositories/lot.repository";
import { MaterialRepository } from "@/lib/repositories/material.repository";
import { ProductionRunRepository } from "@/lib/repositories/production-run.repository";
import { toPlainObject } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ExportButton } from "@/components/shared/export-button";
import { SearchInput } from "@/components/shared/search-input";
import { LotFilters } from "@/components/lots/lot-filters";
import { LotFormSheet } from "@/components/lots/lot-form-sheet";
import { PrintLotsButton } from "@/components/lots/print-lots-button";
import { LotList } from "@/components/lots/lot-list";
import type { LotCardData } from "@/components/lots/lot-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Inventario" };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    materialId?: string;
    locationId?: string;
    clientId?: string;
    status?: string;
    onlyRemnants?: string;
    onlyUnverified?: string;
    includeCancelled?: string;
    arrivedWithin?: string;
  }>;
}

export default async function LotsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [materials, locations, clients, productionRuns] = await Promise.all([
    new MaterialRepository().findOptions(),
    new LocationRepository().findOptions(),
    new ClientRepository().findOptions(),
    new ProductionRunRepository().findOptions(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inventario"
        description="Rollo por rollo"
        action={
          <LotFormSheet
            materials={materials}
            locations={locations}
            clients={clients}
            productionRuns={productionRuns}
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
        <SearchInput placeholder="Folio, tono, material…" className="flex-1 md:max-w-sm" />
        <PrintLotsButton />
        <ExportButton href="/api/export/lots" label="Excel" />
      </div>

      <LotFilters
        materials={materials.map((m) => ({ id: m.id, label: m.name }))}
        locations={locations.map((l) => ({ id: l.id, label: `${l.code} · ${l.name}` }))}
        clients={clients.map((c) => ({ id: c.id, label: c.name }))}
      />

      <Suspense key={JSON.stringify(params)} fallback={<ListSkeleton />}>
        <ListSection params={params} />
      </Suspense>
    </div>
  );
}

async function ListSection({ params }: { params: Awaited<PageProps["searchParams"]> }) {
  const result = await new LotRepository().search({
    search: params.q,
    materialId: params.materialId,
    locationId: params.locationId,
    clientId: params.clientId,
    status: params.status as LotStatus | undefined,
    isRemnant: params.onlyRemnants === "true" ? true : undefined,
    verified: params.onlyUnverified === "true" ? false : undefined,
    includeCancelled: params.includeCancelled === "true",
    // Viene de la URL y el usuario puede teclear cualquier cosa: un NaN
    // colado en el where haría fallar la consulta entera.
    arrivedWithinDays: parsePositiveInt(params.arrivedWithin),
    pageSize: 50,
  });

  // Los Decimal de Prisma no cruzan al cliente sin convertirse.
  const lots = toPlainObject(result.items) as unknown as LotCardData[];
  const isFiltered = Object.entries(params).some(([, value]) => Boolean(value));

  return <LotList lots={lots} total={result.total} isFiltered={isFiltered} />;
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
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  );
}
