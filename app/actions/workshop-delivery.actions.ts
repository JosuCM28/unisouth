"use server";

import { executeAction } from "@/lib/core/action-handler";
import { WorkshopDeliveryService } from "@/lib/services/workshop-delivery.service";
import { confirmWorkshopDeliverySchema } from "@/lib/validations/workshop-delivery.schema";

/* `/orders` entra porque ahí es donde la casa lee que ya llegó. */
const REVALIDATE = ["/workshop-orders", "/orders"];

export async function confirmWorkshopDeliveryAction(input: unknown) {
  return executeAction(input, {
    schema: confirmWorkshopDeliverySchema,
    permission: "workshop-orders:access",
    revalidate: REVALIDATE,
    successMessage: "Entrega marcada como recibida",
    handler: ({ input, user, auditContext }) =>
      new WorkshopDeliveryService(auditContext).confirmReceipt(
        input.id,
        user.role,
        input.notes,
      ),
  });
}
