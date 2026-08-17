import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { PageHeader } from "@/components/layout/page-header";
import { CalculatorForm, type ProductOption } from "@/components/calculations/calculator-form";

export const metadata: Metadata = { title: "Cálculo" };

export default async function CalculationsPage() {
  const [products, sizes, clients] = await Promise.all([
    prisma.finishedProduct.findMany({
      where: { active: true, deletedAt: null },
      select: {
        id: true, code: true, name: true,
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
      select: { id: true, code: true, name: true },
      orderBy: { order: "asc" },
    }),
    new ClientRepository().findOptions(),
  ]);

  const options: ProductOption[] = products.map((product) => ({
    id: product.id,
    code: product.code,
    name: product.name,
    activeBomId: product.billsOfMaterials[0]?.id ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Cálculo de material"
        description="Cuánto se necesita y qué falta comprar"
      />
      <CalculatorForm products={options} sizes={sizes} clients={clients} />
    </div>
  );
}
