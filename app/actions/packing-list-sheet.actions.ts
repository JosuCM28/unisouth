"use server";

import { executeAction } from "@/lib/core/action-handler";
import { PackingListSheetService } from "@/lib/services/packing-list-sheet.service";
import { packingListSheetSchema } from "@/lib/validations/packing-list-sheet.schema";

/** Guarda el packing list editado; la exportación lo lee de ahí. */
export async function savePackingListSheetAction(input: unknown) {
  return executeAction(input, {
    schema: packingListSheetSchema,
    permission: "packing:write",
    revalidate: ["/packing"],
    successMessage: "Packing list guardado",
    handler: ({ input, auditContext }) => new PackingListSheetService(auditContext).save(input),
  });
}
