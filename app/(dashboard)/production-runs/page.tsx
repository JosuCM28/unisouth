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

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function ProductionRunsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
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

      <Suspense key={q} fallback={<ListSkeleton />}>
        <ListSection search={q} clients={clients} />
      </Suspense>
    </div>
  );
}

async function ListSection({
  search,
  clients,
}: {
  search?: string;
  clients: { id: string; name: string }[];
}) {
  const repository = new ProductionRunRepository();
  const term = search?.trim();

  const [withDetail, filtered] = await Promise.all([
    repository.findAllWithDetail(),
    term ? repository.search({ search: term, pageSize: 100 }) : null,
  ]);

  const matched = filtered ? new Set(filtered.items.map((r) => r.id)) : null;
  const runs = matched
    ? withDetail.filter((run) => matched.has(run.id))
    : withDetail;

  return <ProductionRunList runs={runs} clients={clients} isFiltered={Boolean(term)} />;
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
