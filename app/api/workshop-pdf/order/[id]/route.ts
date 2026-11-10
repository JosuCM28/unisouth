import { roleHasPermission } from "@/lib/constants/roles";
import { NotFoundError } from "@/lib/core/errors";
import { inlinePdfResponse, pdfErrorResponse } from "@/lib/core/pdf-response";
import { enforceRateLimit, EXPORT_LIMIT } from "@/lib/core/rate-limit";
import { requireUser } from "@/lib/core/session";
import { renderOrderPdf } from "@/lib/orders/order-pdf";
import { orderSheetFileName, toOrderSheet } from "@/lib/orders/order-sheet";
import { OrderSheetRepository } from "@/lib/repositories/order-sheet.repository";
import { WorkshopDeliveryService } from "@/lib/services/workshop-delivery.service";

/**
 * La hoja de la orden en PDF, para leerla en el celular.
 *
 * Misma barrera que /print/order: quien mira las órdenes abre cualquiera; un
 * taller, sólo las que tiene con una entrega vigente.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Dibujar un PDF cuesta CPU: sin tope, recargarlo es un vector de abuso.
    await enforceRateLimit("pdf:order", EXPORT_LIMIT);

    const user = await requireUser();
    const { id } = await params;

    if (!roleHasPermission(user.role, "orders:browse")) {
      await new WorkshopDeliveryService().assertCanPrintOrder(user.role, id);
    }

    const order = await new OrderSheetRepository().findSheetOrder(id);
    if (!order) throw new NotFoundError("la orden");

    const sheet = toOrderSheet(order);
    return inlinePdfResponse(
      await renderOrderPdf(sheet),
      orderSheetFileName(sheet),
    );
  } catch (error) {
    return pdfErrorResponse(error);
  }
}
