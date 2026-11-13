import type { Metadata } from "next";
import { Package2, Plus } from "lucide-react";
import { ProductRepository } from "@/lib/repositories/product.repository";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { GarmentCategoryRepository } from "@/lib/repositories/garment-category.repository";
import { PageHeader } from "@/components/layout/page-header";
import { Pager } from "@/components/shared/pager";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { ProductList } from "@/components/products/product-list";
import { CategoryFilter } from "@/components/products/category-filter";
import { GarmentCategorySection } from "@/components/products/garment-category-section";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/core/session";

export const metadata: Metadata = { title: "Productos" };

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ page?: string; all?: string; category?: string }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  /* Esto es del lado de producción, no del almacén: el auxiliar recibe y
     surte, pero no decide cómo se hace la prenda. El enlace oculto es
     comodidad visual; ésta es la línea que de verdad la cierra. */
  await requirePermission("production:browse");

  const params = await searchParams;
  const page = parsePositiveInt(params.page) ?? 1;

  const categoryList = await new GarmentCategoryRepository().findAllWithCounts();
  const categories = categoryList.map(({ id, name }) => ({ id, name }));
  /* Un id que no es del catálogo se ignora: filtrar por basura de la URL
     enseñaría una lista vacía sin explicar por qué. */
  const categoryId = categories.some((c) => c.id === params.category) ? params.category : undefined;

  const [result, clients] = await Promise.all([
    new ProductRepository().findPage({
      page, pageSize: PAGE_SIZE, accumulate: params.all === "1", categoryId,
    }),
    new ClientRepository().findOptions(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Productos"
        description="Lo que se produce y su ficha técnica"
        action={
          <ProductFormDialog
            clients={clients}
            categories={categories}
            trigger={<Button className="touch-target"><Plus className="size-4" aria-hidden />Nuevo</Button>}
          />
        }
      />

      <CategoryFilter categories={categories} activeId={categoryId} />

      {result.items.length === 0 ? (
        <div className="flat-surface">
          <EmptyState icon={Package2} title="Aún no hay productos"
            description="Da de alta el primer producto para poder armar su ficha técnica." />
        </div>
      ) : (
        <ProductList products={result.items} clients={clients} categories={categories} />
      )}

      <Pager
        page={page}
        totalPages={result.totalPages}
        total={result.total}
        itemLabel={{ one: "producto", many: "productos" }}
        basePath="/products"
        params={params}
      />

      <GarmentCategorySection categories={categoryList} />
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
