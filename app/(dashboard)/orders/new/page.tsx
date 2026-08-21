import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { getOrderFormOptions } from "@/lib/order-form-options";
import { PageHeader } from "@/components/layout/page-header";
import { OrderForm } from "@/components/orders/order-form";

export const metadata: Metadata = { title: "Nueva orden" };

interface PageProps {
  /** Vienen de la ficha del pedido, para no volver a teclear lo que ya sabe. */
  searchParams: Promise<{ folder?: string; client?: string; due?: string }>;
}

export default async function NewOrderPage({ searchParams }: PageProps) {
  await requirePermission("inventory:write");

  const [options, params] = await Promise.all([
    getOrderFormOptions(),
    searchParams,
  ]);

  /* Sólo se precarga la carpeta si de verdad existe y está viva: un id
     inventado en la URL dejaría el selector en un valor que no está entre las
     opciones, y el formulario se guardaría sin pedido sin avisar. */
  const folderId = options.folders.some((folder) => folder.id === params.folder)
    ? params.folder
    : undefined;
  const clientId = options.clients.some((client) => client.id === params.client)
    ? params.client
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={folderId ? `/orders/folders/${folderId}` : "/orders"}
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {folderId ? "Pedido" : "Órdenes"}
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
        folders={options.folders}
        defaults={{ folderId, clientId, dueDate: params.due }}
      />
    </div>
  );
}
