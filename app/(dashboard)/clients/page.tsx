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

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function ClientsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

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

      <Suspense key={q} fallback={<ListSkeleton />}>
        <ListSection search={q} />
      </Suspense>
    </div>
  );
}

async function ListSection({ search }: { search?: string }) {
  const repository = new ClientRepository();
  const term = search?.trim();

  const [withCount, filtered] = await Promise.all([
    repository.findAllWithLotCount(),
    term ? repository.search({ search: term, pageSize: 100 }) : null,
  ]);

  const matched = filtered ? new Set(filtered.items.map((c) => c.id)) : null;
  const clients = matched
    ? withCount.filter((client) => matched.has(client.id))
    : withCount;

  return <ClientList clients={clients} isFiltered={Boolean(term)} />;
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
