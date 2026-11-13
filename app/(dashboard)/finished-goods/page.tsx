import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { ClientRepository } from "@/lib/repositories/client.repository";
import {
  FINISHED_STOCK_LIMIT,
  FinishedGoodsRepository,
} from "@/lib/repositories/finished-goods.repository";
import { GarmentCategoryRepository } from "@/lib/repositories/garment-category.repository";
import { SizeRepository } from "@/lib/repositories/size.repository";
import type { FinishedGoodsFilters as Filters } from "@/lib/validations/finished-goods.schema";
import { PageHeader } from "@/components/layout/page-header";
import { FinishedAdjustDialog, type AdjustOptions } from "@/components/finished-goods/finished-adjust-dialog";
import { FinishedGoodsFilters } from "@/components/finished-goods/finished-goods-filters";
import { FinishedGoodsView } from "@/components/finished-goods/finished-goods-view";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Inventario terminado" };

interface PageProps {
  searchParams: Promise<{ q?: string; tipo?: string; cliente?: string; po?: string; talla?: string }>;
}

/** La prenda terminada que tiene Embarques, por producto, talla y PO. */
export default async function FinishedGoodsPage({ searchParams }: PageProps) {
  const user = await requirePermission("finished-goods:browse");
  const params = await searchParams;
  const filters: Filters = {
    search: params.q, categoryId: params.tipo, clientId: params.cliente, clientPo: params.po, sizeId: params.talla,
  };
  const canAdjust = roleHasPermission(user.role, "finished-goods:adjust");

  const repo = new FinishedGoodsRepository();
  const [rows, options, categories, adjustOptions] = await Promise.all([
    repo.findStock(filters),
    repo.findFilterOptions(),
    new GarmentCategoryRepository().findOptions(),
    canAdjust ? loadAdjustOptions(repo) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inventario terminado"
        description="Prenda confeccionada lista para empacar"
        action={adjustOptions && (
          <FinishedAdjustDialog options={adjustOptions}
            trigger={<Button className="touch-target"><Plus className="size-4" aria-hidden />Entrada manual</Button>} />
        )}
      />
      <FinishedGoodsFilters options={{ ...options, categories }} />
      <FinishedGoodsView
        rows={rows}
        truncated={rows.length >= FINISHED_STOCK_LIMIT}
        filtered={Object.values(filters).some(Boolean)}
        adjustOptions={adjustOptions}
      />
    </div>
  );
}

async function loadAdjustOptions(repo: FinishedGoodsRepository): Promise<AdjustOptions> {
  const [products, sizes, clients] = await Promise.all([
    repo.findProductOptions(),
    new SizeRepository().findOptions(),
    new ClientRepository().findOptions(),
  ]);
  return {
    products: products.map(({ garmentCategory, ...product }) => ({
      ...product, category: garmentCategory?.name ?? null,
    })),
    sizes,
    clients,
  };
}
