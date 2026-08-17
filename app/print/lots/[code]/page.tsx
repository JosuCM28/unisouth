import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { getLotSheetData } from "@/lib/lot-sheet-data";
import { generateLotQr } from "@/lib/qr";
import { LotSheet } from "@/components/lots/lot-sheet";
import { LotLabel } from "@/components/lots/lot-label";
import { PrintButton } from "@/components/shared/print-button";

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ formato?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  return { title: `Etiqueta ${decodeURIComponent(code)}` };
}

/**
 * Impresión de un rollo.
 *
 * `?formato=etiqueta` saca la etiqueta chica para pegar en el material;
 * sin ese parámetro sale la hoja completa que acompaña al rollo.
 */
export default async function PrintLotPage({ params, searchParams }: PageProps) {
  await requirePermission("inventory:read");

  const { code } = await params;
  const { formato } = await searchParams;

  const lot = await getLotSheetData(decodeURIComponent(code));
  if (!lot) notFound();

  const qrSvg = await generateLotQr(lot.code);

  return (
    <main className="mx-auto max-w-3xl">
      <div className="p-4 print:hidden">
        <PrintButton />
      </div>

      {formato === "etiqueta" ? (
        <LotLabel lot={lot} qrSvg={qrSvg} />
      ) : (
        <LotSheet lot={lot} qrSvg={qrSvg} />
      )}
    </main>
  );
}
