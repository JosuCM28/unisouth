import { NotFoundError } from "@/lib/core/errors";
import { fileErrorResponse } from "@/lib/core/file-error-response";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { requirePermission } from "@/lib/core/session";
import { xlsxResponse } from "@/lib/export/xlsx";
import { buildMaterialInventoryWorkbook } from "@/lib/export/material-inventory-sheet";
import {
  getMaterialInventoryReport,
  inventoryParamsFromRequest,
} from "@/lib/material-inventory-report";

/** El inventario de un material —por tono y rollo por rollo— en Excel. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Puede recorrer miles de rollos: sin tope es un vector de abuso.
    await enforceRateLimit("export:material-inventory", EXPORT_LIMIT);

    await requirePermission("inventory:browse");

    const report = await getMaterialInventoryReport(
      (await params).id,
      inventoryParamsFromRequest(request),
    );
    if (!report) throw new NotFoundError("el material");

    return xlsxResponse(
      buildMaterialInventoryWorkbook(report),
      `inventario-${fileSlug(report.data.material.code)}`,
    );
  } catch (error) {
    return fileErrorResponse(error);
  }
}

/**
 * La clave admite "/" y acentos (TELA/AZUL), que en un nombre de archivo
 * rompen el encabezado de descarga o se vuelven carpetas al guardarlo.
 */
function fileSlug(code: string): string {
  return code.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "material";
}
