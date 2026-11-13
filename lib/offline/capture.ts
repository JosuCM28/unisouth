"use client";

import { notifyQueueChanged } from "@/hooks/use-offline-queue";
import { enqueue, isQueueAvailable, type QueueKind } from "./queue";
import { submitOrQueue, type SubmitOutcome } from "./submit";

/** Lo que regresa toda captura que lleva folio provisional. */
export interface CapturedWithCode<T> {
  outcome: SubmitOutcome<T>;
  /** El folio provisional, para escribirlo en el papel. */
  localCode: string;
}

/**
 * Captura algo que en papel necesita un número desde ya —una salida, un
 * corte, un envío a taller— y que puede no tener señal.
 *
 * El `offlineId` se genera AQUÍ, una sola vez, y el payload lo lleva dentro:
 * si se manda y se reintenta diez veces, el servidor ve diez veces el mismo
 * id y lo guarda una sola. Es lo que hace seguro reintentar.
 *
 * El folio real NO se inventa en el celular: lo asigna el servidor al subir,
 * el que siga en la serie en ese momento. Dos celulares sin señal no pueden
 * ponerse de acuerdo en quién toma el siguiente número; el servidor sí.
 */
export async function captureWithLocalCode<T>(
  kind: QueueKind,
  buildPayload: (offlineId: string) => unknown,
  summary: string,
  orderId?: string,
): Promise<CapturedWithCode<T>> {
  const offlineId = crypto.randomUUID();
  const localCode = toLocalCode(offlineId);
  const payload = buildPayload(offlineId);

  const outcome = await sendOrQueue<T>(kind, payload, summary, { localCode, orderId });
  notifyQueueChanged();

  return { outcome, localCode };
}

/**
 * Si el navegador ya sabe que no hay red, ni se intenta: esperar a que la
 * petición falle sólo deja al auxiliar viendo "Guardando…" de pie en el
 * andén. Si cree que sí hay, se intenta y `submitOrQueue` encola si falla.
 */
async function sendOrQueue<T>(
  kind: QueueKind,
  payload: unknown,
  summary: string,
  extra: { localCode: string; orderId?: string },
): Promise<SubmitOutcome<T>> {
  if (navigator.onLine || !isQueueAvailable()) {
    return submitOrQueue<T>(kind, payload, summary, extra);
  }

  const item = await enqueue({ kind, payload, summary, ...extra });
  return { status: "queued", item };
}

/**
 * Folio provisional: `TMP-` y seis caracteres del id.
 *
 * Corto para que se escriba a mano. Seis hexadecimales dan 16 millones de
 * combinaciones: dos capturas del mismo celular el mismo día no van a
 * chocar, y si chocaran el folio real las separa al subir.
 */
function toLocalCode(offlineId: string): string {
  return `TMP-${offlineId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
