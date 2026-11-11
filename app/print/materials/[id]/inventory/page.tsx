import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/core/session";
import {
  getMaterialInventoryReport,
  type MaterialInventoryParams,
} from "@/lib/material-inventory-report";
import { PrintSheet } from "@/components/shared/print-sheet";
import { MaterialInventoryPrint } from "@/components/materials/material-inventory-print";

export const metadata: Metadata = { title: "Inventario del material" };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<MaterialInventoryParams>;
}

/**
 * El inventario de un material en papel o PDF: la contraparte del Excel.
 *
 * Aparte de la hoja de pila a propósito. Aquella se pega a la estiba y se topa
 * en 200 rollos; ésta es un reporte que se manda a quien no tiene la tela
 * enfrente, y lleva todos los rollos que cumplen el filtro.
 */
export default async function PrintMaterialInventoryPage({
  params,
  searchParams,
}: PageProps) {
  await requirePermission("inventory:browse");

  const { id } = await params;
  const report = await getMaterialInventoryReport(id, await searchParams);

  if (!report) notFound();

  const { material, totals } = report.data;

  return (
    <PrintSheet
      title={`Inventario · ${material.name}`}
      criteria={[material.code, ...report.criteria]}
      count={`${totals.lots} ${totals.lots === 1 ? "rollo" : "rollos"}`}
    >
      <MaterialInventoryPrint data={report.data} />
    </PrintSheet>
  );
}
