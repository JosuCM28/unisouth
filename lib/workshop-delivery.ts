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

/** Lo mismo para una salida de corte, que no tiene envío detrás. */
export function voucherDeliveryState(input: {
  status: DocumentStatus;
  receivedAt: Date | null;
}): WorkshopDeliveryState {
  if (input.status === "CANCELLED") return "CANCELLED";
  return input.receivedAt ? "RECEIVED" : "PENDING";
}

/** Lo que la casa lee de una entrega: si ya llegó, y quién lo dijo. */
export interface DeliveryReceipt {
  state: WorkshopDeliveryState;
  receivedAt: Date | null;
  receivedByName: string | null;
}

/** `null` = el taller no confirma nada: decir "por recibir" sería prometerlo. */
export function shipmentReceipt(shipment: {
  status: GarmentShipmentStatus;
  createdAt: Date;
  receivedAt: Date | null;
  receivedBy: { name: string } | null;
  document: { status: DocumentStatus } | null;
  workshop: { accessRole: string | null; accessSince: Date | null };
}): DeliveryReceipt | null {
  if (!isTrackedByWorkshop(shipment.workshop, shipment.createdAt)) return null;

  return {
    state: deliveryState({
      status: shipment.status,
      documentStatus: shipment.document?.status ?? null,
      receivedAt: shipment.receivedAt,
    }),
    receivedAt: shipment.receivedAt,
    receivedByName: shipment.receivedBy?.name ?? null,
  };
}

/**
 * Sólo un vale ya APLICADO le aparece al taller: un borrador todavía se puede
 * corregir o cambiar de taller, y confirmaría algo que luego deja de ser cierto.
 */
export function voucherReceipt(voucher: {
  status: DocumentStatus;
  appliedAt: Date | null;
  workshopReceivedAt: Date | null;
  workshopReceivedBy: { name: string } | null;
  workshop: { accessRole: string | null; accessSince: Date | null } | null;
}): DeliveryReceipt | null {
  if (!voucher.workshop || !voucher.appliedAt) return null;
  if (!isTrackedByWorkshop(voucher.workshop, voucher.appliedAt)) return null;

  return {
    state: voucherDeliveryState({
      status: voucher.status,
      receivedAt: voucher.workshopReceivedAt,
    }),
    receivedAt: voucher.workshopReceivedAt,
    receivedByName: voucher.workshopReceivedBy?.name ?? null,
  };
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
