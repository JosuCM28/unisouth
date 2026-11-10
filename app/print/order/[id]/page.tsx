import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { toOrderSheet } from "@/lib/orders/order-sheet";
import { OrderSheetRepository } from "@/lib/repositories/order-sheet.repository";
import { WorkshopDeliveryService } from "@/lib/services/workshop-delivery.service";
import { PrintButton } from "@/components/shared/print-button";
import { OrderPrintSheet } from "@/components/orders/order-print-sheet";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Orden de corte" };

/**
 * Hoja de una orden para archivar o firmar en el taller.
 *
 * QUÉ dice la hoja lo decide `toOrderSheet`, el mismo que arma el PDF que el
 * taller abre en el celular: aquí sólo se dibuja.
 */
export default async function PrintOrderPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  /* Quien mira las órdenes imprime cualquiera; un taller, sólo las que tiene
     con una entrega vigente. */
  if (!roleHasPermission(user.role, "orders:browse")) {
    await new WorkshopDeliveryService().assertCanPrintOrder(user.role, id);
  }

  const order = await new OrderSheetRepository().findSheetOrder(id);
  if (!order) notFound();

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-black">
      <PrintButton />
      <OrderPrintSheet sheet={toOrderSheet(order)} />
    </main>
  );
}
