import type { DocumentStatus, GarmentShipmentStatus } from "@prisma/client";
import type { WorkshopDeliveryState } from "@/lib/constants/workshop-access";

/**
 * En qué estado ve el taller una entrega.
 *
 * Cancelar el VALE desde Salidas también la cancela para el taller, aunque el
 * envío siga vivo: el envío y su vale se cancelan por separado, y un taller
 * reimprimiendo un papel que ya no vale es justo lo que se quiere evitar.
 *
 * Lo cancelado gana sobre lo recibido: si se recibió y luego se canceló, lo
 * que importa hoy es que esa entrega ya no cuenta.
 */
export function deliveryState(input: {
  status: GarmentShipmentStatus;
  documentStatus: DocumentStatus | null;
  receivedAt: Date | null;
}): WorkshopDeliveryState {
  if (input.status === "CANCELLED" || input.documentStatus === "CANCELLED") {
    return "CANCELLED";
  }
  return input.receivedAt ? "RECEIVED" : "PENDING";
}

/**
 * Si este envío le aparece al taller en su lista.
 *
 * Decide también si "borrar" puede borrarlo de verdad: lo que el taller ya vio
 * no puede desaparecer sin explicación, y lo que nunca vio sí.
 */
export function isTrackedByWorkshop(
  workshop: { accessRole: string | null; accessSince: Date | null },
  shipmentCreatedAt: Date,
): boolean {
  if (!workshop.accessRole || !workshop.accessSince) return false;
  return shipmentCreatedAt >= workshop.accessSince;
}
