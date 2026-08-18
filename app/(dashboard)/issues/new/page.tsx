import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { LotRepository } from "@/lib/repositories/lot.repository";
import { MaterialRepository } from "@/lib/repositories/material.repository";
import { PageHeader } from "@/components/layout/page-header";
import { IssueForm } from "@/components/issues/issue-form";
import type { IssueProductOption } from "@/components/issues/issue-from-calculation";

export const metadata: Metadata = { title: "Nueva salida" };

/** Centinela del material propio: en la base es `clientId = null`. */
const FACTORY_OWNER = "__factory__";

export default async function NewIssuePage() {
  // Ocultar el enlace es comodidad visual, no seguridad: el registro de
  // salidas lo ven los roles de sólo lectura y desde ahí se alcanza esta
  // ruta escribiéndola. La barrera real es ésta.
  await requirePermission("inventory:write");

  const [issuable, materials, products, sizes, clients, productionRuns] =
    await Promise.all([
      // Qué hay REALMENTE surtible hoy, por dueño y material.
      new LotRepository().findIssuableOptions(),
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

  /* Sólo se ofrecen dueños y materiales CON existencia, y cada uno dice
     cuántos rollos tiene. Ofrecer el catálogo completo obligaba a adivinar:
     de 26 clientes, 23 devolvían una lista vacía sin decir por qué. */
  const stockByClient = new Map<string, number>();
  const stockByMaterial = new Map<string, number>();
  // Qué materiales tiene cada dueño, para filtrar en cascada sin ir al servidor.
  const materialsByClient = new Map<string, Set<string>>();

  for (const row of issuable) {
    // `null` = material de la propia fábrica, sin cliente dueño.
    const clientKey = row.clientId ?? FACTORY_OWNER;
    stockByClient.set(clientKey, (stockByClient.get(clientKey) ?? 0) + row.count);
    stockByMaterial.set(
      row.materialId,
      (stockByMaterial.get(row.materialId) ?? 0) + row.count,
    );

    const set = materialsByClient.get(clientKey) ?? new Set<string>();
    set.add(row.materialId);
    materialsByClient.set(clientKey, set);
  }

  const clientsWithStock = [
    ...(stockByClient.has(FACTORY_OWNER)
      ? [
          {
            id: FACTORY_OWNER,
            name: "De la fábrica",
            lotCount: stockByClient.get(FACTORY_OWNER) ?? 0,
          },
        ]
      : []),
    ...clients
      .filter((client) => stockByClient.has(client.id))
      .map((client) => ({
        id: client.id,
        name: client.name,
        lotCount: stockByClient.get(client.id) ?? 0,
      })),
  ];

  const materialsWithStock = materials
    .filter((material) => stockByMaterial.has(material.id))
    .map((material) => ({
      id: material.id,
      code: material.code,
      name: material.name,
      lotCount: stockByMaterial.get(material.id) ?? 0,
      // Se serializa el Set: un Map/Set no cruza al Client Component.
      clientIds: [...materialsByClient.entries()]
        .filter(([, materialIds]) => materialIds.has(material.id))
        .map(([clientId]) => clientId),
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
        materials={materialsWithStock}
        products={productOptions}
        sizes={sizes}
        cutSizes={sizes}
        clients={clientsWithStock}
        productionRuns={productionRuns}
      />
    </div>
  );
}
