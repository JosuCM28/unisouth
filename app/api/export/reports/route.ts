import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { csvResponse, toCsv, type CsvColumn } from "@/lib/csv";
import { ReportService } from "@/lib/services/report.service";

/**
 * Un renglón del CSV.
 *
 * El reporte tiene cuatro bloques con formas distintas (ranking, clientes,
 * flujo, alertas) y Excel abre UNA tabla. En vez de mandar cuatro archivos se
 * aplanan en un solo listado con una columna "Sección": así quien lo recibe
 * puede filtrar por esa columna o hacer su propia tabla dinámica.
 */
interface ReportCsvRow {
  section: string;
  concept: string;
  detail: string;
  value: number;
}

const COLUMNS: CsvColumn<ReportCsvRow>[] = [
  { header: "Sección", value: (row) => row.section },
  { header: "Concepto", value: (row) => row.concept },
  { header: "Detalle", value: (row) => row.detail },
  { header: "Cantidad", value: (row) => row.value },
];

const ALLOWED_RANGES = [30, 90, 365];

export async function GET(request: Request) {
  // Recorre el kárdex completo: sin límite es un vector de denegación.
  await enforceRateLimit("export:reports", EXPORT_LIMIT);

  await requirePermission("inventory:read");

  const days = parseRange(new URL(request.url).searchParams.get("dias"));
  const report = await new ReportService().getReport(days);

  const rows: ReportCsvRow[] = [
    {
      section: "Resumen",
      concept: "Salió a producción",
      detail: `Últimos ${days} días`,
      value: report.summary.totalConsumed,
    },
    {
      section: "Resumen",
      concept: "Entró al almacén",
      detail: `Últimos ${days} días`,
      value: report.summary.totalReceived,
    },
    {
      section: "Resumen",
      concept: "Producciones activas",
      detail: "Ahora mismo",
      value: report.summary.activeRuns,
    },
    {
      section: "Resumen",
      concept: "Rollos en bodega",
      detail: "Ocupando lugar",
      value: report.summary.lotsInWarehouse,
    },

    ...report.ranking.map((row) => ({
      section: "Producciones",
      concept: row.productionRunName,
      detail: row.clientName,
      value: row.quantity,
    })),

    ...report.byClient.map((row) => ({
      section: "Consumo por cliente",
      concept: row.clientName,
      detail: "Material consumido",
      value: row.quantity,
    })),

    ...report.flow.map((row) => ({
      section: "Movimiento del almacén",
      concept: row.label,
      detail: "Entró",
      value: row.inbound,
    })),
    ...report.flow.map((row) => ({
      section: "Movimiento del almacén",
      concept: row.label,
      detail: "Salió",
      value: row.outbound,
    })),

    ...report.alerts.map((row) => ({
      section: "Focos de atención",
      concept: row.label,
      detail: row.detail,
      value: row.count,
    })),
  ];

  return csvResponse(toCsv(rows, COLUMNS), `reporte-${days}d`);
}

function parseRange(value: string | null): number {
  const parsed = Number(value);
  return ALLOWED_RANGES.includes(parsed) ? parsed : 30;
}
