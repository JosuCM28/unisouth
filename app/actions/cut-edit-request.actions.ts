"use server";

import { executeAction } from "@/lib/core/action-handler";
import {
  cutEditRequestSchema,
  cutEditReviewSchema,
} from "@/lib/validations/cut-edit-request.schema";
import { CutEditRequestService } from "@/lib/services/cut-edit-request.service";

const REVALIDATE = ["/orders", "/cut-edit-requests"];

/** Pide abrir una orden terminada. La misma llave con la que se captura. */
export async function requestCutEditAction(input: unknown) {
  return executeAction(input, {
    schema: cutEditRequestSchema,
    permission: "cuts:write",
    revalidate: REVALIDATE,
    successMessage: "Solicitud enviada",
    handler: ({ input, auditContext }) =>
      new CutEditRequestService(auditContext).request(input),
  });
}

/** Autoriza o rechaza. Sólo quien puede abrir el candado por sí mismo. */
export async function reviewCutEditAction(input: unknown) {
  return executeAction(input, {
    schema: cutEditReviewSchema,
    permission: "cuts:unlock",
    revalidate: REVALIDATE,
    successMessage: "Solicitud contestada",
    handler: ({ input, auditContext }) =>
      new CutEditRequestService(auditContext).review(input),
  });
}
