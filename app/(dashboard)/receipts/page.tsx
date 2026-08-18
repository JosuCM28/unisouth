import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { ReceiptRepository } from "@/lib/repositories/receipt.repository";
import { toPlainObject } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { ReceiptFilters } from "@/components/receipts/receipt-filters";
import { ReceiptList } from "@/components/receipts/receipt-list";
import { Pager } from "@/components/shared/pager";
import type { ReceiptCardData } from "@/lib/repositories/receipt.repository";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Recepciones" };

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    clientId?: string;
    supplierId?: string;
    carrierId?: string;
    arrivedWithin?: string;
    page?: string;
  }>;
}

export default async function ReceiptsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [options, user] = await Promise.all([
    new ReceiptRepository().findFilterOptions(),
    getCurrentUser(),
  ]);

  // Sin permiso de escritura no se ofrece el alta: el botón llevaría a una
  // pantalla que rebota.
  const canCreate = user
    ? roleHasPermission(user.role, "inventory:write")
    : false;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Recepciones"
        description="Qué llegó, cuándo y en qué guía"
        action={
          canCreate ? (
            <Button asChild className="touch-target">
              <Link href="/receipts/new">
                <Plus className="size-4" aria-hidden />
                Nueva
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Guía, folio, factura, proveedor…"
          className="flex-1 md:max-w-sm"
        />
      </div>

      <ReceiptFilters
        clients={options.clients.map((c) => ({ id: c.id, label: c.name }))}
        suppliers={options.suppliers.map((s) => ({ id: s.id, label: s.name }))}
        carriers={options.carriers.map((c) => ({ id: c.id, label: c.name }))}
      />

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
  const page = parsePositiveInt(params.page) ?? 1;

  const result = await new ReceiptRepository().search({
    search: params.q,
    clientId: params.clientId,
    supplierId: params.supplierId,
    carrierId: params.carrierId,
    arrivedWithinDays: parsePositiveInt(params.arrivedWithin),
    page,
    pageSize: PAGE_SIZE,
  });

  // Los Decimal de Prisma no cruzan al cliente sin convertirse.
  const receipts = toPlainObject(result.items) as unknown as ReceiptCardData[];
  // La página no cuenta como filtro: estar en la 3 no significa que el
  // usuario haya buscado algo, y el mensaje de lista vacía cambia según eso.
  const isFiltered = Object.entries(params).some(
    ([key, value]) => key !== "page" && Boolean(value),
  );

  return (
    <>
      <ReceiptList
        receipts={receipts}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        isFiltered={isFiltered}
      />
      <Pager
        page={result.page}
        totalPages={result.totalPages}
        basePath="/receipts"
        params={params}
      />
    </>
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
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ))}
    </div>
  );
}
