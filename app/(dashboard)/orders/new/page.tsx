import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { getOrderFormOptions } from "@/lib/order-form-options";
import { PageHeader } from "@/components/layout/page-header";
import { OrderForm } from "@/components/orders/order-form";

export const metadata: Metadata = { title: "Nueva orden" };

export default async function NewOrderPage() {
  await requirePermission("inventory:write");

  const options = await getOrderFormOptions();

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
        title="Nueva orden"
        description="Qué pidieron y de cuántas tallas"
      />

      <OrderForm
        clients={options.clients}
        materials={options.materials}
        productionRuns={options.productionRuns}
        sizes={options.sizes}
        tags={options.tags}
      />
    </div>
  );
}
