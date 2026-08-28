import type { Metadata } from "next";
import { AuditRepository } from "@/lib/repositories/audit.repository";
import { requirePermission } from "@/lib/core/session";
import {
  parseAuditFilters,
  type AuditSearchParams,
} from "@/lib/export/audit-filters";
import {
  AUDIT_ACTION_LABELS,
  SENSITIVITY_LABELS,
} from "@/lib/constants/labels";
import { formatDateTime } from "@/lib/utils";
import { PrintSheet, PrintTable } from "@/components/shared/print-sheet";

export const metadata: Metadata = { title: "Auditoría impresa" };

interface PageProps {
  searchParams: Promise<AuditSearchParams>;
}

/**
 * La bitácora filtrada, en papel o PDF.
 *
 * Se imprime cuando hay que llevar el rastro de algo a una junta o adjuntarlo
 * a una aclaración, que es cuando importa que traiga el filtro escrito arriba.
 */
export default async function PrintAuditPage({ searchParams }: PageProps) {
  // La barrera real: sin audit:read no se ve nada, aunque se adivine la URL.
  await requirePermission("audit:read");

  const params = await searchParams;
  const logs = await new AuditRepository().findAllForExport(
    parseAuditFilters(params),
  );

  const rows = logs.map((log) => [
    formatDateTime(log.createdAt),
    log.userName ?? log.user?.name ?? "Sistema",
    AUDIT_ACTION_LABELS[log.action] ?? log.action,
    log.entity,
    log.reference ?? "—",
    SENSITIVITY_LABELS[log.sensitivity] ?? log.sensitivity,
    log.reason ?? "",
  ]);

  const criteria: string[] = [];
  if (params.userId) criteria.push("una persona");
  if (params.entity) criteria.push(`entidad ${params.entity}`);
  if (params.action) criteria.push(AUDIT_ACTION_LABELS[params.action as keyof typeof AUDIT_ACTION_LABELS] ?? params.action);
  if (params.sensitivity) criteria.push(`sensibilidad ${params.sensitivity}`);
  if (params.from) criteria.push(`desde ${params.from}`);
  if (params.to) criteria.push(`hasta ${params.to}`);

  return (
    <PrintSheet
      title="Bitácora de auditoría"
      criteria={criteria.length > 0 ? criteria : ["sin filtro"]}
      count={`${logs.length} ${logs.length === 1 ? "registro" : "registros"}`}
    >
      <PrintTable
        head={[
          "Fecha",
          "Usuario",
          "Acción",
          "Entidad",
          "Referencia",
          "Sensibilidad",
          "Motivo",
        ]}
        rows={rows}
        empty="Ningún registro cumple con ese filtro."
      />
    </PrintSheet>
  );
}
