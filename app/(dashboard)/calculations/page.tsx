import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { ClientRepository } from "@/lib/repositories/client.repository";
import { ProductRepository } from "@/lib/repositories/product.repository";
import { SizeRepository } from "@/lib/repositories/size.repository";
import { PageHeader } from "@/components/layout/page-header";
import { CalculatorForm } from "@/components/calculations/calculator-form";

export const metadata: Metadata = { title: "Cálculo" };

export default async function CalculationsPage() {
  await requirePermission("calculation:run");

  const [products, sizes, clients] = await Promise.all([
    new ProductRepository().findOptions(),
    new SizeRepository().findOptions(),
    new ClientRepository().findOptions(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Cálculo de material"
        description="Cuánto se necesita y qué falta comprar"
      />
      <CalculatorForm products={products} sizes={sizes} clients={clients} />
    </div>
  );
}
