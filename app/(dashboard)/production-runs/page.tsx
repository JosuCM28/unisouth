import { Suspense } from "react";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { ProductionRunRepository } from "@/lib/repositories/production-run.repository";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { ProductionRunFormDialog } from "@/components/production-runs/production-run-form-dialog";
import { ProductionRunList } from "@/components/production-runs/production-run-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Producciones" };

const PAGE_SIZE = 50;
/** Los mismos que ofrece el selector de la tabla. */
const PAGE_SIZES = [10, 25, 50, 100];

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; all?: string; filas?: string }>;
}

export default async function ProductionRunsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const clients = await new ClientRepository().findOptions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Producciones"
        description="Corridas a las que se surte material"
        action={
          <ProductionRunFormDialog
            clients={clients}
            trigger={
              <Button className="touch-target">
                <Plus className="size-4" aria-hidden />
                Nueva
              </Button>
            }
          />
        }
      />

      <SearchInput placeholder="Buscar por código, nombre o cliente…" className="max-w-sm" />

      <Suspense key={JSON.stringify(params)} fallback={<ListSkeleton />}>
        <ListSection params={params} clients={clients} />
      </Suspense>
    </div>
  );
}

async function ListSection({
  params,
  clients,
}: {
  params: Awaited<PageProps["searchParams"]>;
  clients: { id: string; name: string }[];
}) {
  const term = params.q?.trim();
  const page = parsePositiveInt(params.page) ?? 1;
  /* Se acota a los tamaños del selector: cualquier otro valor en la URL se
     ignora en vez de dejar que alguien pida 100 000 filas a mano. */
  const pageSize = PAGE_SIZES.includes(Number(params.filas))
    ? Number(params.filas)
    : PAGE_SIZE;

  // Una sola consulta trae la página con cliente y conteo. Antes se traían
  // TODAS las corridas y se cruzaban en memoria: como una producción nunca se
  // borra —sólo se cierra—, esa lista sólo crece temporada tras temporada.
  const result = await new ProductionRunRepository().searchWithDetail({
    search: term,
    page,
    pageSize,
    // "Cargar más" del celular: trae desde la primera fila hasta ésta.
    accumulate: params.all === "1",
  });

  return (
    <ProductionRunList
      runs={result.items}
      clients={clients}
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
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}
