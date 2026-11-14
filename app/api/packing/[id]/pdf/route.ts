import { fileErrorResponse } from "@/lib/core/file-error-response";
import { inlinePdfResponse } from "@/lib/core/pdf-response";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { packingListFileName } from "@/lib/packing/packing-list";
import { loadPackingList } from "@/lib/packing/packing-list-loader";
import { renderPackingListPdf } from "@/lib/packing/packing-list-pdf";

/** El packing list en PDF, para verlo en el celular o imprimirlo. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Dibujar un PDF cuesta CPU: sin tope, recargarlo es un vector de abuso.
    await enforceRateLimit("pdf:packing-list", EXPORT_LIMIT);
    const { id } = await params;
    const list = await loadPackingList(id);
    return inlinePdfResponse(await renderPackingListPdf(list), `${packingListFileName(list)}.pdf`);
  } catch (error) {
    return fileErrorResponse(error);
  }
}
