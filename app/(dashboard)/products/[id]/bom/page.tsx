import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MaterialRepository } from "@/lib/repositories/material.repository";
import { PageHeader } from "@/components/layout/page-header";
import { BomEditor, type BomEditorLine } from "@/components/boms/bom-editor";

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.finishedProduct.findUnique({
    where: { id }, select: { name: true },
  });
  return { title: product ? `Ficha de ${product.name}` : "Ficha técnica" };
}

export default async function BomPage({ params }: PageProps) {
  const { id } = await params;

  const [product, materials, sizes] = await Promise.all([
    prisma.finishedProduct.findUnique({
      where: { id },
      include: {
        billsOfMaterials: {
          orderBy: { version: "desc" },
          take: 1,
          include: {
            lines: { orderBy: { order: "asc" } },
            _count: { select: { calculationLines: true } },
          },
        },
      },
    }),
    new MaterialRepository().findOptions(),
    prisma.size.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true },
      orderBy: { order: "asc" },
    }),
  ]);

  if (!product) notFound();

  const current = product.billsOfMaterials[0];

  const bom = current
    ? {
        id: current.id,
        version: current.version,
        status: current.status,
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
        description={bom ? `Versión ${bom.version} · ${bom.status}` : "Sin ficha todavía"}
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
