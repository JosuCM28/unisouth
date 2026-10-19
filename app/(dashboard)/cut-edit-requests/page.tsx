import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { CutEditRequestRepository } from "@/lib/repositories/cut-edit-request.repository";
import { PageHeader } from "@/components/layout/page-header";
import { ChannelSection } from "@/components/notifications/channel-section";
import { CutEditRequestList } from "@/components/cut-edit-requests/cut-edit-request-list";

export const metadata: Metadata = { title: "Solicitudes de edición" };

/**
 * Quién pidió corregir los cortes de una orden terminada, y qué se le
 * contestó. Las pendientes arriba; debajo, las últimas resueltas para poder
 * ver quién abrió qué sin ir a la auditoría.
 */
export default async function CutEditRequestsPage() {
  await requirePermission("cuts:unlock");

  const repository = new CutEditRequestRepository();
  const [pending, resolved] = await Promise.all([
    repository.findPending(),
    repository.findRecentResolved(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Solicitudes de edición"
        description="Permisos para corregir cortes de órdenes terminadas. Cada autorización sirve para un guardado y vence en 24 h."
      />

      <ChannelSection title="Pendientes" description="Esperan tu respuesta">
        <CutEditRequestList
          requests={pending}
          reviewable
          emptyText="No hay solicitudes pendientes"
        />
      </ChannelSection>

      <ChannelSection title="Recientes" description="Las últimas contestadas">
        <CutEditRequestList
          requests={resolved}
          emptyText="Aún no se ha contestado ninguna"
        />
      </ChannelSection>
    </div>
  );
}
