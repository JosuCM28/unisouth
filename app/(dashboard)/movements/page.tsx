import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { MovementDirection, MovementType } from "@prisma/client";
import { MovementRepository } from "@/lib/repositories/movement.repository";
import { requirePermission } from "@/lib/core/session";
import { toPlainObject } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { MovementFilters } from "@/components/movements/movement-filters";
import { MovementList } from "@/components/movements/movement-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Movimientos" };

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    direction?: string;
    type?: string;
    materialId?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function MovementsPage({ searchParams }: PageProps) {
  await requirePermission("inventory:read");

  const params = await searchParams;
  const materials = await new MovementRepository().findMaterials();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Movimientos"
        description="Historial de entradas y salidas del almacén"
      />

      <MovementFilters materials={materials} />

      {/* La clave fuerza a Suspense a remontar al cambiar un filtro: sin
          ella, la lista anterior se queda pintada mientras llega la nueva. */}
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
  const repository = new MovementRepository();

  const filters = {
    direction: params.direction as MovementDirection | undefined,
    type: params.type as MovementType | undefined,
    materialId: params.materialId,
    from: params.from ? new Date(params.from) : undefined,
    // Hasta el final del día: si no, "hasta el 16" excluiría todo el día 16.
    to: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
  };

  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [result, totals] = await Promise.all([
    repository.search({ ...filters, page, pageSize: PAGE_SIZE }),
    repository.totalsByDirection(filters),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <TotalCard
          label="Entró"
          amount={totals.inbound}
          icon={ArrowDownLeft}
          className="text-state-available"
        />
        <TotalCard
          label="Salió"
          amount={totals.outbound}
          icon={ArrowUpRight}
          className="text-state-defective"
        />
      </div>

      <p className="tabular text-xs text-muted-foreground">
        {result.total} {result.total === 1 ? "movimiento" : "movimientos"}
        {result.totalPages > 1 &&
          ` · página ${result.page} de ${result.totalPages}`}
      </p>

      <MovementList movements={toPlainObject(result.items)} />

      <Pager
        page={result.page}
        totalPages={result.totalPages}
        params={params}
      />
    </div>
  );
}

/**
 * Totales del periodo filtrado.
 *
 * Sin unidad: se suman metros con piezas y con kilos, así que el número sólo
 * sirve como orden de magnitud del movimiento del periodo. Para un total
 * fiable hay que filtrar por material.
 */
function TotalCard({
  label,
  amount,
  icon: Icon,
  className,
}: {
  label: string;
  amount: number;
  icon: typeof ArrowDownLeft;
  className: string;
}) {
  return (
    <div className="flat-surface flex items-center justify-between gap-3 p-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`size-4 ${className}`} aria-hidden />
        {label}
      </span>
      <span className={`tabular text-lg font-semibold ${className}`}>
        {amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Awaited<PageProps["searchParams"]>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(target: number): string {
    const next = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") next.set(key, value);
    }

    next.set("page", String(target));
    return `/movements?${next}`;
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        asChild={page > 1}
        variant="outline"
        disabled={page <= 1}
        className="touch-target"
      >
        {page > 1 ? <Link href={hrefFor(page - 1)}>Anteriores</Link> : <span>Anteriores</span>}
      </Button>

      <span className="tabular text-xs text-muted-foreground">
        {page} / {totalPages}
      </span>

      <Button
        asChild={page < totalPages}
        variant="outline"
        disabled={page >= totalPages}
        className="touch-target"
      >
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)}>Siguientes</Link>
        ) : (
          <span>Siguientes</span>
        )}
      </Button>
    </div>
  );
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
