import Link from "next/link";
import { FileText } from "lucide-react";
import type { ProductListItem } from "@/lib/repositories/product.repository";
import { Button } from "@/components/ui/button";
import { ProductActions } from "./product-actions";

interface Props {
  products: ProductListItem[];
  clients: { id: string; name: string }[];
}

/** Server Component: sólo el menú de cada fila necesita ser cliente. */
export function ProductList({ products, clients }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {products.map((product) => (
        <li key={product.id} className="flat-surface flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="tabular text-sm font-medium">{product.code}</p>
            <p className="truncate text-sm">{product.name}</p>
            <p className="text-xs text-muted-foreground">
              {product.clientName ?? "Sin cliente"} · {bomLabel(product.bomVersion)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="outline" className="touch-target">
              <Link href={`/products/${product.id}/bom`}>
                <FileText className="size-4" aria-hidden />
                Ficha
              </Link>
            </Button>
            <ProductActions product={product} clients={clients} />
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
