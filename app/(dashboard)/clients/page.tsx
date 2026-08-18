import { Suspense } from "react";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClientList } from "@/components/clients/client-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Clientes" };

const PAGE_SIZE = 50;
/** Los mismos que ofrece el selector de la tabla. */
const PAGE_SIZES = [10, 25, 50, 100];

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; all?: string; filas?: string }>;
}

export default async function ClientsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description="Dueños del material que se maquila"
        action={
          <ClientFormDialog
            trigger={
              <Button className="touch-target">
                <Plus className="size-4" aria-hidden />
                Nuevo
              </Button>
            }
          />
        }
      />

      <SearchInput placeholder="Buscar por nombre o código…" className="max-w-sm" />

      <Suspense key={JSON.stringify(params)} fallback={<ListSkeleton />}>
        <ListSection params={params} />
      </Suspense>
    </div>
  );
}

async function ListSection({
  params,
}: {
  params: Awaited<PageProps["searchParams"]>;
}) {
  const term = params.q?.trim();
  const page = parsePositiveInt(params.page) ?? 1;
  /* Se acota a los tamaños del selector: cualquier otro valor en la URL se
     ignora en vez de dejar que alguien pida 100 000 filas a mano. */
  const pageSize = PAGE_SIZES.includes(Number(params.filas))
    ? Number(params.filas)
    : PAGE_SIZE;

  // Una sola consulta: la búsqueda, el conteo de rollos y el recorte de la
  // página los resuelve Postgres. Antes se traía el catálogo COMPLETO y se
  // filtraba en memoria, que aguanta 20 clientes pero no 20 000.
  const result = await new ClientRepository().searchWithLotCount({
    search: term,
    page,
    pageSize,
    // "Cargar más" del celular: trae desde la primera fila hasta ésta.
    accumulate: params.all === "1",
  });

  return (
    <ClientList
      clients={result.items}
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
