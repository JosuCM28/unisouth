import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Package2, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Productos" };

export default async function ProductsPage() {
  const [products, clients] = await Promise.all([
    prisma.finishedProduct.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
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
    </div>
  );
}
