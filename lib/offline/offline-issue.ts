"use client";

import type { Unit } from "@prisma/client";
import { todayInputValue } from "@/lib/utils";
import { captureWithLocalCode, type CapturedWithCode } from "./capture";

/** Lo que captura la pantalla de salida sin conexión. */
export interface OfflineIssueDraft {
  clientId: string;
  /** La orden de la que sale la tela, cuando se captura desde su ficha. */
  cuttingOrderId?: string;
  concept: string;
  reference: string;
  handedOverBy: string;
  receivedBy: string;
  lines: { lotId: string; quantity: number; unit: Unit }[];
}

export type CapturedIssue = CapturedWithCode<{ code: string }>;

/**
 * Captura una salida que puede no tener señal.
 *
 * Con señal se manda de inmediato y se aplica igual que en línea. Sin
 * señal —o si la red falla a la mitad— se encola con su folio TMP.
 */
export function captureOfflineIssue(
  draft: OfflineIssueDraft,
  summary: string,
): Promise<CapturedIssue> {
  return captureWithLocalCode(
    "issue.create",
    (offlineId) => ({ offlineId, document: toDocumentPayload(draft) }),
    summary,
    draft.cuttingOrderId,
  );
}

/**
 * La salida con la forma de `documentSchema`. La fecha es la de HOY en el
 * celular, no la de cuando se sube: el material salió hoy aunque la señal
 * vuelva mañana.
 */
function toDocumentPayload(draft: OfflineIssueDraft) {
  return {
    type: "ISSUE" as const,
    date: todayInputValue(),
    clientId: draft.clientId,
    cuttingOrderId: draft.cuttingOrderId,
    concept: draft.concept,
    reference: draft.reference,
    handedOverBy: draft.handedOverBy,
    receivedBy: draft.receivedBy,
    lines: draft.lines.map((line) => ({
      lotId: line.lotId,
      quantity: line.quantity,
      unit: line.unit,
    })),
  };
}
