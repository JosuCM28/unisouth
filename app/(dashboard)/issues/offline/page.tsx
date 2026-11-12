import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { PageHeader } from "@/components/layout/page-header";
import { OfflineIssueForm } from "@/components/offline/issue/offline-issue-form";

export const metadata: Metadata = { title: "Salida sin conexión" };

/**
 * Salida de rollos sobre la copia local, para cuando no hay señal.
 *
 * Pide `inventory:write`, la misma llave que la salida en línea. No lee nada
 * del servidor: todo sale de IndexedDB, que es lo que la deja abrir sin red
 * una vez que el service worker guardó la pantalla.
 */
export default async function OfflineIssuePage() {
  await requirePermission("inventory:write");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Salida sin conexión"
        description="Se aplica al momento si hay señal; si no, en cuanto vuelva el internet"
      />
      <OfflineIssueForm />
    </div>
  );
}
