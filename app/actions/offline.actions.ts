"use server";

import { executeAction } from "@/lib/core/action-handler";
import { downloadOfflineTableSchema } from "@/lib/validations/offline.schema";
import { offlineIssueSchema } from "@/lib/validations/offline-issue.schema";
import { offlineCutSchema } from "@/lib/validations/offline-cut.schema";
import { offlineShipmentSchema } from "@/lib/validations/offline-shipment.schema";
import { CuttingOrderService } from "@/lib/services/cutting-order.service";
import { DocumentService } from "@/lib/services/document.service";
import { GarmentShipmentService } from "@/lib/services/garment-shipment.service";
import { OfflineSnapshotService } from "@/lib/services/offline-snapshot.service";

/**
 * Baja UNA tabla para la copia sin conexión.
 *
 * Una por llamada y no todo junto: el inventario de rollos puede pesar
 * varios megas, y si la señal se cae a la mitad se pierde sólo esa tabla en
 * vez de la descarga entera. También deja a la pantalla mostrar el avance.
 *
 * No revalida nada: sólo lee.
 */
export async function downloadOfflineTableAction(input: unknown) {
  return executeAction(input, {
    schema: downloadOfflineTableSchema,
    permission: "offline:manage",
    handler: ({ input, user, auditContext }) =>
      new OfflineSnapshotService(auditContext).downloadTable(input.table, user.role),
  });
}

/**
 * Sube una salida capturada sin internet: la crea y la aplica juntas.
 *
 * Pide `inventory:write`, la MISMA llave que capturar y aplicar una salida
 * en línea: trabajar sin señal no abre ni cierra ninguna puerta.
 */
export async function syncOfflineIssueAction(input: unknown) {
  return executeAction(input, {
    schema: offlineIssueSchema,
    permission: "inventory:write",
    revalidate: ["/issues", "/lots", "/dashboard"],
    successMessage: "Salida sin conexión aplicada",
    handler: ({ input, auditContext }) =>
      new DocumentService(auditContext).createAndApplyOffline(
        input.document,
        input.offlineId,
      ),
  });
}

/**
 * Sube un corte capturado sin internet. Pide `cuts:write`, la misma llave
 * que capturarlo en línea.
 */
export async function syncOfflineCutAction(input: unknown) {
  return executeAction(input, {
    schema: offlineCutSchema,
    permission: "cuts:write",
    revalidate: ["/orders", "/dashboard"],
    successMessage: "Corte sin conexión guardado",
    handler: ({ input, auditContext }) =>
      new CuttingOrderService(auditContext).saveOfflineBatch(input.batch, input.offlineId),
  });
}

/**
 * Sube un envío a taller capturado sin internet. Misma llave que en línea
 * (`inventory:write`) y mismas rutas: el envío levanta su vale en Salidas.
 */
export async function syncOfflineShipmentAction(input: unknown) {
  return executeAction(input, {
    schema: offlineShipmentSchema,
    permission: "inventory:write",
    revalidate: ["/orders", "/dashboard", "/issues"],
    successMessage: "Envío sin conexión registrado",
    handler: ({ input, auditContext }) =>
      new GarmentShipmentService(auditContext).createOffline(
        input.shipment,
        input.offlineId,
      ),
  });
}
