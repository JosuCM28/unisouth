import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Package2, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { PageHeader } from "@/components/layout/page-header";
import { Pager } from "@/components/shared/pager";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/core/session";

export const metadata: Metadata = { title: "Productos" };

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ page?: string; all?: string }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  /* Dirección no recorre el almacén: sin `inventory:browse` esta pantalla
     no está en su menú, y ésta es la línea que de verdad la cierra —el
     enlace oculto es comodidad visual, no seguridad. */
  await requirePermission("inventory:browse");

  const params = await searchParams;
  const page = parsePositiveInt(params.page) ?? 1;
  /* "Cargar más" del celular: trae desde la primera fila hasta el final de
     esta página, porque cada toque es una navegación y lo ya mostrado no
     sobrevive en estado del cliente. Se topa para no bajar la tabla entera. */
  const accumulate = params.all === "1";
  const skip = accumulate ? 0 : (page - 1) * PAGE_SIZE;
  const take = accumulate ? Math.min(page * PAGE_SIZE, 300) : PAGE_SIZE;
  const where = { deletedAt: null };

  const [total, products, clients] = await Promise.all([
    prisma.finishedProduct.count({ where }),
    prisma.finishedProduct.findMany({
      where,
      // El id desempata: dos productos pueden llamarse igual y sin criterio
      // estable se barajarían entre páginas.
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip,
      take,
      include: {
        client: { select: { name: true } },
        billsOfMaterials: {
          where: { status: "ACTIVE" },
          select: { id: true, version: true },
          take: 1,
        },
      },
    }),
    new ClientRepository().findOptions(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Productos"
        description="Lo que se produce y su ficha técnica"
        action={
          <ProductFormDialog
            clients={clients}
            trigger={<Button className="touch-target"><Plus className="size-4" aria-hidden />Nuevo</Button>}
          />
        }
      />

      {products.length === 0 ? (
        <div className="flat-surface">
          <EmptyState icon={Package2} title="Aún no hay productos"
            description="Da de alta el primer producto para poder armar su ficha técnica." />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((product) => {
            const bom = product.billsOfMaterials[0];
            return (
              <li key={product.id} className="flat-surface flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="tabular text-sm font-medium">{product.code}</p>
                  <p className="truncate text-sm">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.client?.name ?? "Sin cliente"}
                    {bom ? ` · ficha v${bom.version}` : " · sin ficha activa"}
                  </p>
                </div>

                <Button asChild variant="outline" className="touch-target shrink-0">
                  <Link href={`/products/${product.id}/bom`}>
                    <FileText className="size-4" aria-hidden />
                    Ficha
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Pager
        page={page}
        totalPages={totalPages}
        total={total}
        itemLabel={{ one: "producto", many: "productos" }}
        basePath="/products"
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
