import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FolderOpen, FolderPlus } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { OrderFolderRepository } from "@/lib/repositories/order-folder.repository";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/orders/folder-card";
import { FolderArchiveFilter } from "@/components/orders/folder-archive-filter";

export const metadata: Metadata = { title: "Pedidos" };

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    archived?: string;
    page?: string;
    all?: string;
  }>;
}

/**
 * Todos los pedidos, paginados.
 *
 * Existe porque en /orders los pedidos son un aperitivo: ahí se asoman los
 * más recientes y la lista completa vive aquí. Separarlas no es un capricho
 * de navegación —por cada carpeta hay que sumar sus órdenes y sus renglones,
 * y traerlas todas es la consulta que se cae cuando la fábrica acumula
 * pedidos—, y de paso deja cada pantalla contestando una sola pregunta.
 */
export default async function OrderFoldersPage({ searchParams }: PageProps) {
  await requirePermission("inventory:browse");

  const params = await searchParams;
  const page = parsePositiveInt(params.page) ?? 1;
  /* "Cargar más" del celular: trae desde la primera fila hasta el final de
     esta página, porque cada toque es una navegación y lo ya mostrado no
     sobrevive en estado del cliente. */
  const accumulate = params.all === "1";
  const showArchived = params.archived === "1";

  const filters = {
    search: params.q?.trim() || undefined,
    includeArchived: showArchived,
  };

  const repository = new OrderFolderRepository();

  const [folders, total] = await Promise.all([
    repository.findAllWithTotals({
      ...filters,
      skip: accumulate ? 0 : (page - 1) * PAGE_SIZE,
      limit: accumulate ? page * PAGE_SIZE : PAGE_SIZE,
    }),
    repository.countWithTotals(filters),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const isFiltered = Boolean(filters.search || showArchived);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/orders"
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Órdenes
      </Link>

      <PageHeader
        title="Pedidos"
        description="Lo que pidió cada cliente, agrupado"
        action={
          <Button asChild className="touch-target">
            <Link href="/orders/folders/new">
              <FolderPlus className="size-4" aria-hidden />
              Nuevo
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-2">
        <SearchInput
          placeholder="Folio, nombre del pedido, referencia…"
          className="w-full md:max-w-sm"
        />
        <FolderArchiveFilter showArchived={showArchived} />
      </div>

      {folders.length === 0 ? (
        <div className="flat-surface">
          <EmptyState
            icon={FolderOpen}
            title={isFiltered ? "Ningún pedido coincide" : "Aún no hay pedidos"}
            description={
              isFiltered
                ? "Prueba con otras palabras o incluye los archivados."
                : "Agrupa las órdenes de un mismo cliente para seguirlas juntas."
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {folders.map((folder) => (
            <li key={folder.id}>
              <FolderCard folder={folder} />
            </li>
          ))}
        </ul>
      )}

      <Pager
        page={page}
        totalPages={totalPages}
        total={total}
        itemLabel={{ one: "pedido", many: "pedidos" }}
        basePath="/orders/folders"
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
