import { AuditRepository, type AuditLogWithUser } from "@/lib/repositories/audit.repository";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import {
  toXlsxWithNotice,
  xlsxResponse,
  type XlsxColumn,
} from "@/lib/export/xlsx";
import { auditFiltersFromRequest } from "@/lib/export/audit-filters";
import {
  AUDIT_ACTION_LABELS,
  SENSITIVITY_LABELS,
} from "@/lib/constants/labels";

const COLUMNS: XlsxColumn<AuditLogWithUser>[] = [
  /* La fecha va como fecha y no como texto: la bitácora se exporta para
     ordenarla y acotarla por tiempo, y como texto Excel la ordena
     alfabéticamente. El formato incluye la hora porque en auditoría el minuto
     importa: dos cambios del mismo día se distinguen por eso. */
  { header: "Fecha", value: (r) => r.createdAt, kind: "date", width: 18 },
  { header: "Usuario", value: (r) => r.userName ?? r.user?.name ?? "Sistema", width: 22 },
  { header: "Entidad", value: (r) => r.entity },
  { header: "Referencia", value: (r) => r.reference ?? "", width: 18 },
  { header: "Acción", value: (r) => AUDIT_ACTION_LABELS[r.action] ?? r.action },
  { header: "Sensibilidad", value: (r) => SENSITIVITY_LABELS[r.sensitivity] ?? r.sensitivity },
  { header: "Campos cambiados", value: (r) => r.changedFields.join(" | "), width: 30 },
  { header: "Motivo", value: (r) => r.reason ?? "", width: 34 },
  { header: "IP", value: (r) => r.ip ?? "" },
  { header: "Origen", value: (r) => r.source ?? "" },
];

export async function GET(request: Request) {
  // Recorren tablas completas: sin límite, son un vector de denegación.
  await enforceRateLimit("export:audit", EXPORT_LIMIT);

  // La bitácora sólo la exporta quien puede leerla.
  await requirePermission("audit:read");

  /* Los MISMOS filtros que la pantalla. Aquí importaba más que en ningún
     otro lado: la bitácora se exporta para reconstruir qué pasó, y un archivo
     con los últimos 100 registros sin filtrar deja fuera justo el rastro que
     se anda buscando. */
  const items = await new AuditRepository().findAllForExport(
    auditFiltersFromRequest(request),
  );

  return xlsxResponse(
    toXlsxWithNotice(items, COLUMNS, "Auditoría"),
    "auditoria",
  );
}
