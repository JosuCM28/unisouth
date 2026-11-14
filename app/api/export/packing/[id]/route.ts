import { fileErrorResponse } from "@/lib/core/file-error-response";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { buildPackingListWorkbook } from "@/lib/export/packing-list-sheet";
import { xlsxResponse } from "@/lib/export/xlsx";
import { packingListFileName } from "@/lib/packing/packing-list";
import { loadPackingList } from "@/lib/packing/packing-list-loader";

/** El packing list en Excel, el mismo que el PDF. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await enforceRateLimit("export:packing-list", EXPORT_LIMIT);
    const { id } = await params;
    const list = await loadPackingList(id);
    return xlsxResponse(buildPackingListWorkbook(list), packingListFileName(list));
  } catch (error) {
    return fileErrorResponse(error);
  }
}
