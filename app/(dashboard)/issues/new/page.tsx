import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { MaterialRepository } from "@/lib/repositories/material.repository";
import { PageHeader } from "@/components/layout/page-header";
import { IssueForm } from "@/components/issues/issue-form";
import type { IssueProductOption } from "@/components/issues/issue-from-calculation";

export const metadata: Metadata = { title: "Nueva salida" };

export default async function NewIssuePage() {
  // Ocultar el enlace es comodidad visual, no seguridad: el registro de
  // salidas lo ven los roles de sólo lectura y desde ahí se alcanza esta
  // ruta escribiéndola. La barrera real es ésta.
  await requirePermission("inventory:write");

  const [materials, products, sizes, clients, productionRuns] =
    await Promise.all([
      new MaterialRepository().findOptions(),
      prisma.finishedProduct.findMany({
        where: { active: true, deletedAt: null },
        select: {
          id: true,
          code: true,
          name: true,
          billsOfMaterials: {
            where: { status: "ACTIVE" },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.size.findMany({
        where: { active: true },
        // El `group` separa la escala de letra (CH/M/G) de la numérica
        // (26–50): son dos sistemas distintos y mezclarlos en un desplegable
        // hace que alguien elija "G" para un pantalón que se pide por número.
        select: { id: true, code: true, name: true, group: true },
        orderBy: { order: "asc" },
      }),
      new ClientRepository().findOptions(),
      prisma.productionRun.findMany({
        // Una corrida cerrada ya no recibe material: ofrecerla sólo lleva a
        // colgar el vale de la producción equivocada.
        where: { status: { in: ["PLANNED", "ACTIVE"] } },
        select: { id: true, code: true, name: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const productOptions: IssueProductOption[] = products.map((product) => ({
    id: product.id,
    code: product.code,
    name: product.name,
    activeBomId: product.billsOfMaterials[0]?.id ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/issues"
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Salidas
      </Link>

      <PageHeader
        title="Nueva salida"
        description="Qué material se lleva producción"
      />

      <IssueForm
        materials={materials}
        products={productOptions}
        sizes={sizes}
        cutSizes={sizes}
        clients={clients}
        productionRuns={productionRuns}
      />
    </div>
  );
}
