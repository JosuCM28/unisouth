import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { DailyCutService } from "@/lib/services/daily-cut.service";
import { DailyCutPrint } from "@/components/orders/daily-cut-print";
import { PrintButton } from "@/components/shared/print-button";

export const metadata: Metadata = { title: "Lo cortado" };

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}

/** La hoja de "Lo cortado" de Órdenes. De aquí sale el PDF para el jefe. */
export default async function PrintDailyCutPage({ searchParams }: PageProps) {
  await requirePermission("orders:browse");

  const report = await new DailyCutService().getReport(await searchParams);

  return (
    <main className="mx-auto w-full max-w-5xl">
      <div className="p-4 print:hidden">
        <PrintButton />
      </div>
      <DailyCutPrint report={report} />
    </main>
  );
}
