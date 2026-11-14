import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { FinishedGoodsRepository } from "@/lib/repositories/finished-goods.repository";
import { GarmentCategoryRepository } from "@/lib/repositories/garment-category.repository";
import { PackingRepository } from "@/lib/repositories/packing.repository";
import { PageHeader } from "@/components/layout/page-header";
import { FinishedGoodsFilters } from "@/components/finished-goods/finished-goods-filters";
import { BoxContents } from "@/components/packing/box-contents";
import { BoxInventory } from "@/components/packing/box-inventory";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Caja" };

interface PageProps {
  params: Promise<{ id: string; number: string }>;
  searchParams: Promise<{ q?: string; tipo?: string; po?: string; talla?: string }>;
}

/** Una caja: lo que lleva arriba y, abajo, el inventario para llenarla. */
export default async function PackingBoxPage({ params, searchParams }: PageProps) {
  const user = await requirePermission("finished-goods:browse");
  const { id, number } = await params;
  const box = await new PackingRepository().findBox(id, Number.parseInt(number, 10) || 0);
  if (!box) notFound();

  const canEdit = roleHasPermission(user.role, "packing:write") && box.order.status === "OPEN";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Caja ${box.number}`}
        description={`${box.order.name} · ${box.order.code}`}
        action={
          <Button asChild variant="outline" className="touch-target">
            <Link href={`/packing/${id}`}><ArrowLeft className="size-4" aria-hidden />Pedido</Link>
          </Button>
        }
      />
      <BoxContents boxId={box.id} lines={box.lines} canEdit={canEdit} />
      {canEdit && <BoxFiller boxId={box.id} clientId={box.order.clientId} filters={await searchParams} />}
    </div>
  );
}

/**
 * El inventario para llenarla, ya acotado al dueño del pedido: lo de otro
 * cliente ni se ofrece.
 */
async function BoxFiller({
  boxId,
  clientId,
  filters,
}: {
  boxId: string;
  clientId: string | null;
  filters: { q?: string; tipo?: string; po?: string; talla?: string };
}) {
  const repo = new FinishedGoodsRepository();
  const [rows, options, categories] = await Promise.all([
    repo.findStock({
      search: filters.q, categoryId: filters.tipo, clientPo: filters.po, sizeId: filters.talla,
      forClientId: clientId ?? undefined,
    }),
    repo.findFilterOptions(),
    new GarmentCategoryRepository().findOptions(),
  ]);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agregar del inventario</h2>
      <FinishedGoodsFilters options={{ ...options, clients: [], categories }} />
      <BoxInventory boxId={boxId} rows={rows} />
    </section>
  );
}
