import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { PageHeader } from "@/components/layout/page-header";
import { FolderForm } from "@/components/orders/folder-form";

export const metadata: Metadata = { title: "Nuevo pedido" };

export default async function NewOrderFolderPage() {
  await requirePermission("inventory:write");

  const clients = await prisma.client.findMany({
    where: { deletedAt: null, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

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
        title="Nuevo pedido"
        description="La carpeta que agrupa las órdenes de un mismo pedido"
      />

      <FolderForm clients={clients} />
    </div>
  );
}
