import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { WorkshopDeliveryService } from "@/lib/services/workshop-delivery.service";
import {
  CancelledDelivery,
  DeliveryDetail,
} from "@/components/workshop-orders/delivery-detail";

export const metadata: Metadata = { title: "Entrega" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkshopOrderPage({ params }: PageProps) {
  const user = await requirePermission("workshop-orders:access");
  const { id } = await params;

  const delivery = await new WorkshopDeliveryService().detailForRole(
    user.role,
    id,
  );
  if (!delivery) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/workshop-orders"
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Órdenes
      </Link>

      {delivery.state === "CANCELLED" ? (
        <CancelledDelivery code={delivery.code} />
      ) : (
        <DeliveryDetail delivery={delivery} />
      )}
    </div>
  );
}
