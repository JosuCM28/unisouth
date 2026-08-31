import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { getIssueFormOptions, FACTORY_OWNER } from "@/lib/issue-form-options";
import { PageHeader } from "@/components/layout/page-header";
import { IssueForm } from "@/components/issues/issue-form";
import type { EditableIssue } from "@/components/issues/issue-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Editar salida" };

/**
 * Corrección de una salida en BORRADOR.
 *
 * Sólo borradores: una salida aplicada ya movió inventario y editarla dejaría
 * el kárdex sin explicación. Si se llega aquí con una aplicada se rebota a su
 * ficha, donde las acciones disponibles son imprimir y cancelar.
 */
export default async function EditIssuePage({ params }: PageProps) {
  const user = await requirePermission("inventory:write");

  /* Corregir el metraje de un rollo desde el vale es un reconteo, y eso pesa
     más que armar la salida: se resuelve aquí, en el servidor, y el
     formulario sólo recibe el sí o el no. */
  const canAdjust = roleHasPermission(user.role, "inventory:adjust");

  const { id } = await params;

  const document = await prisma.inventoryDocument.findUnique({
    where: { id },
    include: {
      lines: {
        orderBy: { order: "asc" },
        include: {
          lot: {
            include: {
              material: { select: { name: true } },
            },
          },
        },
      },
      cutLines: { orderBy: { order: "asc" } },
    },
  });

  if (!document || document.type !== "ISSUE") notFound();

  // La barrera real está en el servicio; ésta evita mostrar un formulario que
  // el servidor va a rechazar al guardar.
  if (document.status !== "DRAFT") redirect(`/documents/${document.id}`);

  const options = await getIssueFormOptions();

  const editable: EditableIssue = {
    id: document.id,
    // El material propio viaja con el centinela: en la base es `null`.
    clientId: document.clientId ?? FACTORY_OWNER,
    productionRunId: document.productionRunId,
    concept: document.concept,
    reference: document.reference,
    receivedBy: document.receivedBy,
    notes: document.notes,
    cutHeader: {
      cutDescription: document.cutDescription ?? "",
      cutFabricId: document.cutFabricId ?? "",
      cutFabricText: document.cutFabricText ?? "",
      cutPattern: document.cutPattern ?? "",
      cutVersion: document.cutVersion ?? "",
      cutVersionNotes: document.cutVersionNotes ?? "",
      cutNotes: document.cutNotes,
    },
    lines: document.lines.map((line) => ({
      lotId: line.lotId,
      lotCode: line.lot.code,
      materialName: line.lot.material.name,
      shade: line.lot.shade,
      isRemnant: line.lot.isRemnant,
      /* Lo disponible incluye lo que este mismo borrador ya tiene apartado:
         si no, corregir un renglón de 40 m a 45 m se vería como excedido
         contra un saldo que todavía no se ha descontado. */
      available:
        Number(line.lot.currentQuantity) - Number(line.lot.reservedQuantity),
      unit: line.unit,
      quantity: String(Number(line.quantity)),
    })),
    cutLines: document.cutLines.map((line) => ({
      key: line.id,
      sizeId: line.sizeId,
      quantity: String(line.quantity),
      bundles: String(line.bundles),
      tag: line.tagId ?? "",
      notes: line.notes ?? "",
    })),
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/documents/${document.id}`}
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {document.code}
      </Link>

      <PageHeader
        title={`Editar ${document.code}`}
        description="Corrige el borrador antes de aplicarlo"
      />

      <IssueForm
        materials={options.materials}
        products={options.products}
        sizes={options.sizes}
        cutSizes={options.sizes}
        cutTags={options.cutTags}
        clients={options.clients}
        productionRuns={options.productionRuns}
        document={editable}
        canAdjust={canAdjust}
      />
    </div>
  );
}
