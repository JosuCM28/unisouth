import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { getLotSheetsData } from "@/lib/lot-sheet-data";
import { generateLotQrs } from "@/lib/qr";
import { LotSheet } from "@/components/lots/lot-sheet";
import { LotLabel } from "@/components/lots/lot-label";
import { PrintButton } from "@/components/shared/print-button";
import { EmptyState } from "@/components/shared/empty-state";

interface PageProps {
  searchParams: Promise<{
    ids?: string;
    materialId?: string;
    locationId?: string;
    clientId?: string;
    receiptId?: string;
    formato?: string;
  }>;
}

export const metadata: Metadata = { title: "Imprimir rollos" };

/**
 * Imprime un juego de rollos: una hoja por cada uno.
 *
 * Se llega desde el inventario con los filtros ya aplicados, o pasando ids
 * concretos. Sirve para imprimir de golpe todo lo que llegó en una recepción.
 */
export default async function PrintLotsPage({ searchParams }: PageProps) {
  await requirePermission("inventory:browse");

  const params = await searchParams;
  const isLabel = params.formato === "etiqueta";

  const lots = await getLotSheetsData({
    ids: params.ids?.split(",").filter(Boolean),
    materialId: params.materialId,
    locationId: params.locationId,
    clientId: params.clientId,
    receiptId: params.receiptId,
  });

  const qrs = await generateLotQrs(lots.map((lot) => lot.code));

  if (lots.length === 0) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <EmptyState
          title="No hay rollos que imprimir"
          description="Ajusta los filtros del inventario y vuelve a intentarlo."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 print:hidden">
        <p className="tabular text-sm text-muted-foreground">
          {lots.length} {lots.length === 1 ? "hoja" : "hojas"}
        </p>
        <PrintButton />
      </div>

      {/* Las etiquetas van varias por hoja; las fichas, una por página. */}
      <div className={isLabel ? "flex flex-col items-center gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-start print:flex-row print:flex-wrap print:p-0" : ""}>
        {lots.map((lot) =>
          isLabel ? (
            <LotLabel key={lot.id} lot={lot} qrSvg={qrs.get(lot.code) ?? ""} />
          ) : (
            <LotSheet key={lot.id} lot={lot} qrSvg={qrs.get(lot.code) ?? ""} />
          ),
        )}
      </div>
    </main>
  );
}
