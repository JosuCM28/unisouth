import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { getOrderFormOptions } from "@/lib/order-form-options";
import { toDateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { OrderForm, type EditableOrder } from "@/components/orders/order-form";
import { EMPTY_ORDER_CUT_CLOSING } from "@/components/orders/order-cut-closing";
import { PlantAdoptControl } from "@/components/plant-orders/plant-adopt-control";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await prisma.cuttingOrder.findUnique({
    where: { id },
    select: { code: true },
  });
  return { title: order ? order.code : "Orden de planta" };
}

/**
 * Ficha de una orden de la otra planta: su captura y su semáforo.
 *
 * NO lleva cortes, envíos a taller ni salidas, y no es un olvido: la mesa
 * está en esta planta. Todo eso se captura desde Órdenes una vez que la orden
 * entró al concentrado, contra la MISMA orden —es la misma fila, no una
 * copia—, así que el avance nunca queda partido en dos lugares.
 */
export default async function PlantOrderPage({ params }: PageProps) {
  const user = await requirePermission("plant-orders:browse");
  const canWrite = roleHasPermission(user.role, "plant-orders:write");
  const canAdopt = roleHasPermission(user.role, "plant-orders:adopt");

  const { id } = await params;

  const [order, options] = await Promise.all([
    prisma.cuttingOrder.findUnique({
      where: { id },
      include: {
        folder: { select: { name: true } },
        lines: {
          orderBy: { position: "asc" },
          include: { _count: { select: { progress: true } } },
        },
      },
    }),
    getOrderFormOptions(),
  ]);

  if (!order) notFound();

  /* Una orden de la casa NO se abre por esta puerta: su ficha completa está
     en Órdenes, con sus cortes y sus vales. Enseñarla aquí recortada haría
     creer que esa orden no tiene avance. */
  if (order.origin !== "PLANT") notFound();

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
    /* El cierre viaja vacío porque esta variante no lo pinta. El servicio lo
       conserva tal como está en la base: `updateFromPlant` lo relee y se lo
       devuelve a `update`, para que una corrección de allá no borre los
       metros de una mesa que ya se levantó aquí. */
    cutClosing: EMPTY_ORDER_CUT_CLOSING,
    lines: order.lines.map((line) => ({
      key: line.id,
      id: line.id,
      sizeId: line.sizeId,
      orderedQuantity: String(line.orderedQuantity),
      tagId: line.tagId ?? "",
      notes: line.notes ?? "",
      // Con avance capturado la talla no se quita: se perdería su historial.
      locked: line._count.progress > 0,
    })),
  };

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
        title={order.code}
        description={order.description ?? "Sin descripción"}
      />

      {/* El semáforo va arriba del formulario: lo primero que se pregunta al
          abrir una orden de planta es si ya se la tomaron. */}
      <div className="flat-surface flex flex-wrap items-center justify-between gap-3 p-3">
        <span className="text-sm text-muted-foreground">Concentrado</span>
        <PlantAdoptControl
          order={{
            orderId: order.id,
            orderCode: order.code,
            addedAt: order.addedAt,
            folderName: order.folder?.name ?? null,
          }}
          folders={options.folders}
          canAdopt={canAdopt}
        />
      </div>

      {canWrite ? (
        <OrderForm
          variant="plant"
          order={editable}
          clients={options.clients}
          materials={options.materials}
          productionRuns={options.productionRuns}
          sizes={options.sizes}
          tags={options.tags}
          folders={[]}
        />
      ) : (
        <p className="flat-surface p-3 text-sm text-muted-foreground">
          Esta orden la captura la otra planta. Desde aquí se consulta y se
          decide si entra al concentrado.
        </p>
      )}
    </div>
  );
}
