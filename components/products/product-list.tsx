import Link from "next/link";
import { FileText } from "lucide-react";
import type { GarmentCategoryOption } from "@/lib/repositories/garment-category.repository";
import type { ProductListItem } from "@/lib/repositories/product.repository";
import { Button } from "@/components/ui/button";
import { ProductActions } from "./product-actions";

interface Props {
  products: ProductListItem[];
  clients: { id: string; name: string }[];
  categories: GarmentCategoryOption[];
}

/** Server Component: sólo el menú de cada fila necesita ser cliente. */
export function ProductList({ products, clients, categories }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {products.map((product) => (
        <li key={product.id} className="flat-surface flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="tabular text-sm font-medium">{product.code}</p>
            <p className="truncate text-sm">{product.name}</p>
            <p className="text-xs text-muted-foreground">
              {[product.categoryName ?? "Sin tipo", product.clientName ?? "Sin cliente", bomLabel(product.bomVersion)].join(" · ")}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="outline" className="touch-target">
              <Link href={`/products/${product.id}/bom`}>
                <FileText className="size-4" aria-hidden />
                Ficha
              </Link>
            </Button>
            <ProductActions product={product} clients={clients} categories={categories} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function bomLabel(version: number | null): string {
  if (version === null) return "sin ficha";
  return `ficha v${version}`;
}
