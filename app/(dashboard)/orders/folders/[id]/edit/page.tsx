import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { toDateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import {
  FolderForm,
  type EditableFolder,
} from "@/components/orders/folder-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Editar pedido" };

export default async function EditOrderFolderPage({ params }: PageProps) {
  await requirePermission("inventory:write");

  const { id } = await params;

  const [folder, clients] = await Promise.all([
    prisma.orderFolder.findUnique({ where: { id } }),
    prisma.client.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!folder) notFound();

  const editable: EditableFolder = {
    id: folder.id,
    name: folder.name,
    clientId: folder.clientId,
    reference: folder.reference,
    dueDate: folder.dueDate ? toDateInputValue(folder.dueDate) : null,
    notes: folder.notes,
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/orders/folders/${folder.id}`}
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {folder.code}
      </Link>

      <PageHeader
        title={`Editar ${folder.code}`}
        description="Los datos del pedido. Sus órdenes no se tocan."
      />

      <FolderForm clients={clients} folder={editable} />
    </div>
  );
}
