import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { MovementRepository } from "@/lib/repositories/movement.repository";
import { parseMovementFilters } from "@/lib/export/movement-filters";
import { requirePermission } from "@/lib/core/session";
import { toPlainObject } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { MovementFilters } from "@/components/movements/movement-filters";
import { MovementList } from "@/components/movements/movement-list";
import { ExportButton } from "@/components/shared/export-button";
import { PrintLinkButton } from "@/components/shared/print-link-button";
import { Pager } from "@/components/shared/pager";
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
    all?: string;
  }>;
}

export default async function MovementsPage({ searchParams }: PageProps) {
  await requirePermission("inventory:browse");

  const params = await searchParams;
  const materials = await new MovementRepository().findMaterials();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Movimientos"
        description="Historial de entradas y salidas del almacén"
      />

      <MovementFilters materials={materials} />

      {/* Los dos arrastran el filtro de arriba: el archivo tiene que traer lo
          que se está viendo, no el kárdex completo. */}
      <div className="flex flex-wrap items-center gap-2">
        <ExportButton href="/api/export/movements" label="Excel" />
        <PrintLinkButton href="/print/movements" />
      </div>

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

  /* El MISMO parser que usan el Excel y la hoja impresa, para que el archivo
     traiga exactamente lo que se está viendo. */
  const filters = parseMovementFilters(params);

  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [result, totals] = await Promise.all([
    repository.search({ ...filters, page, pageSize: PAGE_SIZE, accumulate: params.all === "1" }),
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
        total={result.total}
        itemLabel={{ one: "movimiento", many: "movimientos" }}
        basePath="/movements"
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

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}
