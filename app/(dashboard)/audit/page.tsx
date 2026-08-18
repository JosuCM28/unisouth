import { Suspense } from "react";
import type { Metadata } from "next";
import type { AuditAction, Sensitivity } from "@prisma/client";
import { AuditRepository } from "@/lib/repositories/audit.repository";
import { requirePermission } from "@/lib/core/session";
import { toPlainObject } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditList } from "@/components/audit/audit-list";
import { Pager } from "@/components/shared/pager";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Auditoría" };

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    userId?: string;
    entity?: string;
    action?: string;
    sensitivity?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AuditPage({ searchParams }: PageProps) {
  // La barrera real: sin audit:read no se ve nada, aunque se adivine la URL.
  await requirePermission("audit:read");

  const params = await searchParams;
  const repository = new AuditRepository();

  const [actors, entities] = await Promise.all([
    repository.findActors(),
    repository.findEntities(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Auditoría"
        description="Quién metió mano, cuándo y desde dónde"
      />

      <AuditFilters actors={actors} entities={entities} />

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

  const result = await new AuditRepository().search({
    userId: params.userId,
    entity: params.entity,
    action: params.action as AuditAction | undefined,
    sensitivity: params.sensitivity as Sensitivity | undefined,
    from: params.from ? new Date(params.from) : undefined,
    // Hasta el final del día: si no, "hasta el 16" excluiría todo el día 16.
    to: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="tabular text-xs text-muted-foreground">
        {result.total} {result.total === 1 ? "registro" : "registros"}
        {result.totalPages > 1 &&
          ` · página ${result.page} de ${result.totalPages}`}
      </p>
      <AuditList logs={toPlainObject(result.items)} />
      <Pager
        page={result.page}
        totalPages={result.totalPages}
        basePath="/audit"
        params={params}
      />
    </div>
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
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}
