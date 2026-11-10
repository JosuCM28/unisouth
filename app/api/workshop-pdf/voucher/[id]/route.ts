import { roleHasPermission } from "@/lib/constants/roles";
import { NotFoundError } from "@/lib/core/errors";
import { inlinePdfResponse, pdfErrorResponse } from "@/lib/core/pdf-response";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { requireUser } from "@/lib/core/session";
import { VoucherRepository } from "@/lib/repositories/voucher.repository";
import { WorkshopDeliveryService } from "@/lib/services/workshop-delivery.service";
import { renderVoucherPdf } from "@/lib/vouchers/voucher-pdf";
import { toVoucherSheet, voucherFileName } from "@/lib/vouchers/voucher-sheet";

/**
 * El vale en PDF, para leerlo en el celular.
 *
 * El mismo PDF que sale por WhatsApp y la misma barrera que la reimpresión:
 * quien recorre el almacén abre cualquiera; un taller, sólo los suyos y
 * mientras sigan vigentes. El taller lo decide su rol, nunca el id de la URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Dibujar un PDF cuesta CPU: sin tope, recargarlo es un vector de abuso.
    await enforceRateLimit("pdf:voucher", EXPORT_LIMIT);

    const user = await requireUser();
    const { id } = await params;

    if (!roleHasPermission(user.role, "inventory:browse")) {
      await new WorkshopDeliveryService().assertCanPrint(user.role, id);
    }

    const document = await new VoucherRepository().findSheetDocument(id);
    if (!document) throw new NotFoundError("el vale");

    const sheet = toVoucherSheet(document);
    return inlinePdfResponse(
      await renderVoucherPdf(sheet),
      voucherFileName(sheet),
    );
  } catch (error) {
    return pdfErrorResponse(error);
  }
}
