import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { getIssueFormOptions } from "@/lib/issue-form-options";
import { OrderFabricRepository } from "@/lib/repositories/order-fabric.repository";
import { PageHeader } from "@/components/layout/page-header";
import { MultiOrderIssueForm } from "@/components/issues/multi-order-issue-form";

export const metadata: Metadata = { title: "Salida a varias órdenes" };

export default async function MultiOrderIssuePage() {
  // La misma barrera que la salida de una orden: es la misma captura.
  await requirePermission("inventory:write");

  const [options, orders] = await Promise.all([
    getIssueFormOptions(),
    new OrderFabricRepository().issueTargets(),
  ]);

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
        title="Salida a varias órdenes"
        description="Elige las órdenes y asígnale a cada una sus rollos"
      />

      <MultiOrderIssueForm
        orders={orders}
        materials={options.materials.map((material) => ({
          id: material.id,
          code: material.code,
          name: material.name,
          lotCount: material.lotCount,
        }))}
      />
    </div>
  );
}
