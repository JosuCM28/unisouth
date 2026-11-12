"use client";

import type { Unit } from "@prisma/client";
import { todayInputValue } from "@/lib/utils";
import { notifyQueueChanged } from "@/hooks/use-offline-queue";
import { enqueue, isQueueAvailable } from "./queue";
import { submitOrQueue, type SubmitOutcome } from "./submit";

/** Lo que captura la pantalla de salida sin conexión. */
export interface OfflineIssueDraft {
  clientId: string;
  concept: string;
  reference: string;
  handedOverBy: string;
  receivedBy: string;
  lines: { lotId: string; quantity: number; unit: Unit }[];
}

export interface CapturedIssue {
  outcome: SubmitOutcome<{ code: string }>;
  /** El folio provisional, para escribirlo en el vale de papel. */
  localCode: string;
}

/**
 * Captura una salida que puede no tener señal.
 *
 * El `offlineId` se genera AQUÍ, una sola vez, y viaja dentro del payload:
 * si se manda y se reintenta diez veces, el servidor ve diez veces el mismo
 * id y aplica la salida una sola. Es lo que hace seguro reintentar.
 *
 * Con señal se manda de inmediato y se aplica igual que en línea. Sin
 * señal —o si la red falla a la mitad— se encola con su folio TMP.
 */
export async function captureOfflineIssue(
  draft: OfflineIssueDraft,
  summary: string,
): Promise<CapturedIssue> {
  const offlineId = crypto.randomUUID();
  const localCode = toLocalCode(offlineId);
  const payload = { offlineId, document: toDocumentPayload(draft) };

  const outcome = await sendOrQueue(payload, summary, localCode);
  notifyQueueChanged();

  return { outcome, localCode };
}

/**
 * Si el navegador ya sabe que no hay red, ni se intenta: esperar a que la
 * petición falle sólo deja al auxiliar viendo "Guardando…" de pie en el
 * andén. Si cree que sí hay, se intenta y `submitOrQueue` encola si falla.
 */
async function sendOrQueue(
  payload: unknown,
  summary: string,
  localCode: string,
): Promise<SubmitOutcome<{ code: string }>> {
  if (navigator.onLine || !isQueueAvailable()) {
    return submitOrQueue("issue.create", payload, summary, localCode);
  }

  const item = await enqueue({ kind: "issue.create", payload, summary, localCode });
  return { status: "queued", item };
}

/**
 * Folio provisional: `TMP-` y seis caracteres del id.
 *
 * Corto para que se escriba a mano en el vale. Seis hexadecimales dan 16
 * millones de combinaciones: dos salidas del mismo celular el mismo día no
 * van a chocar, y si chocaran el folio real las separa al subir.
 */
function toLocalCode(offlineId: string): string {
  return `TMP-${offlineId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
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
