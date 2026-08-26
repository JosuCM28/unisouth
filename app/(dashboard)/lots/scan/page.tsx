import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { PageHeader } from "@/components/layout/page-header";
import { QrScanner } from "@/components/lots/qr-scanner";

export const metadata: Metadata = { title: "Escanear" };

export default async function ScanPage() {
  await requirePermission("inventory:read");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Escanear"
        description="Apunta al QR del rollo o escribe su folio"
      />
      <QrScanner />
    </div>
  );
}
