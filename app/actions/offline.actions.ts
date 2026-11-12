"use server";

import { executeAction } from "@/lib/core/action-handler";
import { downloadOfflineTableSchema } from "@/lib/validations/offline.schema";
import { offlineIssueSchema } from "@/lib/validations/offline-issue.schema";
import { DocumentService } from "@/lib/services/document.service";
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
    revalidate: ["/documents", "/issues", "/lots", "/dashboard"],
    successMessage: "Salida sin conexión aplicada",
    handler: ({ input, auditContext }) =>
      new DocumentService(auditContext).createAndApplyOffline(
        input.document,
        input.offlineId,
      ),
  });
}
