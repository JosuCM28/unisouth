import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { getOrderFormOptions } from "@/lib/order-form-options";
import { toDateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { OrderForm, type EditableOrder } from "@/components/orders/order-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Editar orden" };

export default async function EditOrderPage({ params }: PageProps) {
  await requirePermission("inventory:write");

  const { id } = await params;

  const order = await prisma.cuttingOrder.findUnique({
    where: { id },
    include: {
      lines: {
        orderBy: { position: "asc" },
        include: { _count: { select: { progress: true } } },
      },
    },
  });

  if (!order) notFound();

  // Una orden cancelada no se edita: su historial ya es sólo consulta.
  if (order.status === "CANCELLED") redirect(`/orders/${order.id}`);

  const options = await getOrderFormOptions();

  const editable: EditableOrder = {
    id: order.id,
    clientId: order.clientId,
    materialId: order.materialId,
    productionRunId: order.productionRunId,
    folderId: order.folderId,
    description: order.description,
    reference: order.reference,
    orderedAt: toDateInputValue(order.orderedAt),
    dueDate: order.dueDate ? toDateInputValue(order.dueDate) : null,
    notes: order.notes,
    cutHeader: {
      cutFabricText: order.cutFabricText ?? "",
      cutPattern: order.cutPattern ?? "",
      cutVersion: order.cutVersion ?? "",
      cutVersionNotes: order.cutVersionNotes ?? "",
      cutNotes: order.cutNotes,
    },
    lines: order.lines.map((line) => ({
      key: line.id,
      id: line.id,
      sizeId: line.sizeId,
      orderedQuantity: String(line.orderedQuantity),
      tagId: line.tagId ?? "",
      notes: line.notes ?? "",
      // Con avance capturado no se puede quitar ni cambiar de talla: se
      // perdería el historial de lo ya cortado.
      locked: line._count.progress > 0,
    })),
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/orders/${order.id}`}
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {order.code}
      </Link>

      <PageHeader
        title={`Editar ${order.code}`}
        description="Corrige el pedido. El avance ya capturado se conserva."
      />

      <OrderForm
        clients={options.clients}
        materials={options.materials}
        productionRuns={options.productionRuns}
        sizes={options.sizes}
        tags={options.tags}
        folders={options.folders}
        order={editable}
      />
    </div>
  );
}
