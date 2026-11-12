import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MaterialRepository } from "@/lib/repositories/material.repository";
import { ProductRepository } from "@/lib/repositories/product.repository";
import { SizeRepository } from "@/lib/repositories/size.repository";
import { requirePermission } from "@/lib/core/session";
import { PageHeader } from "@/components/layout/page-header";
import { BomEditor, type BomEditorLine } from "@/components/boms/bom-editor";

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const name = await new ProductRepository().findName(id);
  return { title: name ? `Ficha de ${name}` : "Ficha técnica" };
}

export default async function BomPage({ params }: PageProps) {
  await requirePermission("bom:write");

  const { id } = await params;

  const [product, materials, sizes] = await Promise.all([
    new ProductRepository().findWithCurrentBom(id),
    new MaterialRepository().findOptions(),
    new SizeRepository().findOptions(),
  ]);

  if (!product) notFound();

  const current = product.billsOfMaterials[0];

  // Decimal no cruza al cliente: todo número va como texto al editor.
  const bom = current
    ? {
        id: current.id,
        version: current.version,
        globalWastePct: String(current.globalWastePct),
        name: current.name,
        usedByCalculations: current._count.calculationLines,
        lines: current.lines.map(
          (line): BomEditorLine => ({
            materialId: line.materialId,
            consumptionPerUnit: String(line.consumptionPerUnit),
            unit: line.unit,
            wastePct: String(line.wastePct),
            sizeId: line.sizeId ?? "",
            isFixedQuantity: line.isFixedQuantity,
            part: line.part ?? "",
          }),
        ),
      }
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/products" className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Productos
      </Link>

      <PageHeader
        title={`Ficha técnica · ${product.name}`}
        description={bom ? `Versión ${bom.version}` : "Sin ficha todavía"}
      />

      <BomEditor
        productId={product.id}
        productName={product.name}
        materials={materials}
        sizes={sizes}
        bom={bom}
      />
    </div>
  );
}
