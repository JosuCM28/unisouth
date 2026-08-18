import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { getPileSheetData } from "@/lib/pile-sheet-data";
import { generatePileQr } from "@/lib/qr";
import { PileSheet } from "@/components/materials/pile-sheet";
import { PrintButton } from "@/components/shared/print-button";
import { EmptyState } from "@/components/shared/empty-state";

interface PageProps {
  searchParams: Promise<{
    materialId?: string;
    clientId?: string;
    locationId?: string;
    /** "1" para incluir agotados y bajas; por omisión sólo lo presente. */
    todos?: string;
  }>;
}

export const metadata: Metadata = { title: "Hoja de pila" };

/**
 * Hoja de una PILA: un material y todos sus rollos en UNA sola hoja.
 *
 * Vive fuera de (dashboard) igual que las demás vistas de impresión, para que
 * salga sin sidebar ni barra móvil. Se imprime, se pega a la estiba y desde
 * ahí se sabe qué hay debajo sin levantar rollo por rollo.
 */
export default async function PrintPilePage({ searchParams }: PageProps) {
  await requirePermission("inventory:read");

  const params = await searchParams;

  if (!params.materialId) {
    return (
      <Empty description="Falta indicar el material. Entra desde el catálogo de materiales." />
    );
  }

  const data = await getPileSheetData({
    materialId: params.materialId,
    clientId: params.clientId,
    locationId: params.locationId,
    onlyPresent: params.todos !== "1",
  });

  if (!data) return <Empty description="Ese material no existe." />;

  if (data.totals.lots === 0) {
    return (
      <Empty
        description={`No hay rollos de ${data.material.name} en bodega${
          params.clientId ? " para ese cliente" : ""
        }.`}
      />
    );
  }

  const qrSvg = await generatePileQr({
    materialId: params.materialId,
    clientId: params.clientId,
    locationId: params.locationId,
  });

  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 print:hidden">
        <p className="tabular text-sm text-muted-foreground">
          {data.totals.lots} {data.totals.lots === 1 ? "rollo" : "rollos"} ·{" "}
          {data.material.name}
        </p>
        <PrintButton />
      </div>

      <PileSheet data={data} qrSvg={qrSvg} />
    </main>
  );
}

function Empty({ description }: { description: string }) {
  return (
    <main className="mx-auto max-w-lg p-8">
      <EmptyState title="No hay pila que imprimir" description={description} />
    </main>
  );
}
