import { AuditRepository, type AuditLogWithUser } from "@/lib/repositories/audit.repository";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { csvResponse, toCsv, type CsvColumn } from "@/lib/csv";
import { formatDateTime } from "@/lib/utils";

const COLUMNS: CsvColumn<AuditLogWithUser>[] = [
  { header: "Fecha", value: (r) => formatDateTime(r.createdAt) },
  { header: "Usuario", value: (r) => r.userName ?? r.user?.name ?? "Sistema" },
  { header: "Entidad", value: (r) => r.entity },
  { header: "Referencia", value: (r) => r.reference ?? "" },
  { header: "Acción", value: (r) => r.action },
  { header: "Sensibilidad", value: (r) => r.sensitivity },
  { header: "Campos cambiados", value: (r) => r.changedFields.join(" | ") },
  { header: "Motivo", value: (r) => r.reason ?? "" },
  { header: "IP", value: (r) => r.ip ?? "" },
  { header: "Origen", value: (r) => r.source ?? "" },
];

export async function GET() {
  // Recorren tablas completas: sin límite, son un vector de denegación.
  await enforceRateLimit("export:audit", EXPORT_LIMIT);

  // La bitácora sólo la exporta quien puede leerla.
  await requirePermission("audit:read");

  const { items } = await new AuditRepository().search({ pageSize: 100 });
  return csvResponse(toCsv(items, COLUMNS), "auditoria");
}
