import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { getOrderFormOptions } from "@/lib/order-form-options";
import { PageHeader } from "@/components/layout/page-header";
import { OrderForm } from "@/components/orders/order-form";

export const metadata: Metadata = { title: "Nueva orden de planta" };

/**
 * Alta de una orden desde la otra planta.
 *
 * Es el MISMO formulario de Órdenes en su variante de planta: los mismos
 * catálogos, las mismas tallas, el mismo encabezado del corte. Lo único que
 * cambia son los dos bloques que no le tocan a quien captura allá —el pedido
 * de la casa y los metros de la mesa— y la acción a la que va, que pide otro
 * permiso.
 */
export default async function NewPlantOrderPage() {
  await requirePermission("plant-orders:write");

  const options = await getOrderFormOptions();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/plant-orders"
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Órdenes de planta
      </Link>

      <PageHeader
        title="Nueva orden"
        description="Qué pidieron y de cuántas tallas"
      />

      <p className="flat-surface p-3 text-sm text-muted-foreground">
        Al guardar, la orden queda registrada con su folio y se avisa a la otra
        planta para que decida si entra a su concentrado. Mientras tanto la
        puedes seguir corrigiendo.
      </p>

      <OrderForm
        variant="plant"
        clients={options.clients}
        materials={options.materials}
        productionRuns={options.productionRuns}
        sizes={options.sizes}
        tags={options.tags}
        /* El selector de pedido no se pinta en esta variante, pero la prop es
           obligatoria: se manda vacía en vez de hacerla opcional para que el
           formulario de la casa no pueda quedarse sin pedidos por descuido. */
        folders={[]}
      />
    </div>
  );
}
