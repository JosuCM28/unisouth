import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { formatQuantity } from "@/lib/utils";
import { FinishedGoodsRepository } from "@/lib/repositories/finished-goods.repository";
import { GarmentCategoryRepository } from "@/lib/repositories/garment-category.repository";
import { PackingRepository } from "@/lib/repositories/packing.repository";
import { PageHeader } from "@/components/layout/page-header";
import { FinishedGoodsFilters } from "@/components/finished-goods/finished-goods-filters";
import { BoxContents } from "@/components/packing/box-contents";
import { BoxInventory } from "@/components/packing/box-inventory";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Caja" };

interface BoxFilters {
  q?: string;
  tipo?: string;
  cliente?: string;
  po?: string;
  talla?: string;
}

interface PageProps {
  params: Promise<{ id: string; number: string }>;
  searchParams: Promise<BoxFilters>;
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
      {canEdit && <BoxFiller boxId={box.id} client={box.order.client} filters={await searchParams} />}
    </div>
  );
}

/**
 * El inventario para llenarla. Con cliente en el pedido se acota a ese
 * dueño (o sin dueño); sin cliente acepta cualquier empresa —Tenaris y
 * Tenaris Shawcor en el mismo embarque— y entonces sí se ofrece el filtro.
 */
async function BoxFiller({
  boxId,
  client,
  filters,
}: {
  boxId: string;
  client: { id: string; name: string } | null;
  filters: BoxFilters;
}) {
  const repo = new FinishedGoodsRepository();
  const [rows, options, categories, hidden] = await Promise.all([
    repo.findStock({
      search: filters.q, categoryId: filters.tipo, clientPo: filters.po, sizeId: filters.talla,
      ...(client ? { forClientId: client.id } : { clientId: filters.cliente }),
    }),
    repo.findFilterOptions(),
    new GarmentCategoryRepository().findOptions(),
    client ? repo.countOtherOwners(client.id) : Promise.resolve(0),
  ]);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agregar del inventario</h2>
      {client && hidden > 0 && <OtherOwnersNotice clientName={client.name} pieces={hidden} />}
      <FinishedGoodsFilters options={{ ...options, clients: client ? [] : options.clients, categories }} />
      <BoxInventory boxId={boxId} rows={rows} />
    </section>
  );
}

/** Para que un inventario acotado no se lea como un inventario vacío. */
function OtherOwnersNotice({ clientName, pieces }: { clientName: string; pieces: number }) {
  return (
    <p className="border border-border bg-muted p-3 text-sm">
      Este pedido es de <span className="font-medium">{clientName}</span>: sólo acepta su prenda o la que no
      tiene cliente. Hay <span className="tabular font-medium">{formatQuantity(pieces)}</span> pzas de otras
      empresas que no se ofrecen. Para mezclar empresas, quita el cliente del pedido.
    </p>
  );
}
