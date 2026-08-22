"use client";

import type { ActionResult } from "@/lib/core/result";
import { QUEUE_KINDS } from "./kinds";
import {
  enqueue,
  isQueueAvailable,
  listPending,
  markAttempt,
  removeItem,
  type QueueKind,
  type QueuedItem,
} from "./queue";

/**
 * Resultado de un envío que pudo terminar en la cola.
 *
 * Es una unión discriminada por `status` para que el formulario no tenga que
 * adivinar: `sent` guardó de verdad, `queued` está pendiente, `failed` lo
 * rechazó el servidor y hay que corregir el formulario.
 */
export type SubmitOutcome<T> =
  | { status: "sent"; data: T; message?: string }
  | { status: "queued"; item: QueuedItem }
  | { status: "failed"; error: string; code: string; field?: string };

/**
 * La distinción que sostiene todo esto: ¿falló la RED o falló el DATO?
 *
 * Una Server Action que llega al servidor SIEMPRE devuelve un ActionResult,
 * incluso cuando el dato está mal: executeAction atrapa el error y responde
 * `{success:false}`. Si en cambio la promesa se RECHAZA, la petición nunca
 * llegó —WiFi caído, servidor dormido, DNS— y eso es lo único que se encola.
 *
 * Encolar un rechazo de negocio sería un desastre: un código de material
 * duplicado se reintentaría en bucle para siempre sin poder tener éxito.
 */
function isNetworkFailure(error: unknown): boolean {
  // Next serializa los fallos de red de una Server Action como TypeError
  // ("Failed to fetch") o como un Error genérico de conexión. No hay un tipo
  // propio que distinguir, así que se toma cualquier rechazo como red: el
  // caso del dato mal ya se resolvió arriba, por la vía del ActionResult.
  return error instanceof Error;
}

/**
 * Manda la captura, y si no hay red la guarda para después.
 *
 * Es lo que envuelve a toda alta: el formulario deja de tener que saber si
 * hay conexión, sólo reacciona a los tres desenlaces.
 */
export async function submitOrQueue<T>(
  kind: QueueKind,
  payload: unknown,
  summary: string,
): Promise<SubmitOutcome<T>> {
  try {
    const result = (await QUEUE_KINDS[kind].send(payload)) as ActionResult<T>;

    if (result.success) {
      return { status: "sent", data: result.data, message: result.message };
    }

    // Llegó al servidor y lo rechazó: es un problema del dato, no de la red.
    // Se devuelve tal cual para pintar el campo en rojo.
    return {
      status: "failed",
      error: result.error,
      code: result.code,
      field: result.field,
    };
  } catch (error) {
    // Sin IndexedDB no hay dónde guardar: mejor decirlo que fingir que se
    // guardó y perder la captura en silencio.
    if (!isNetworkFailure(error) || !isQueueAvailable()) {
      return {
        status: "failed",
        error:
          "No se pudo guardar y este navegador no permite dejarlo pendiente. Revisa la conexión e intenta de nuevo.",
        code: "OFFLINE_UNAVAILABLE",
      };
    }

    const item = await enqueue({ kind, payload, summary });
    return { status: "queued", item };
  }
}

export interface FlushReport {
  sent: number;
  /** Rechazadas por el servidor: se quedan en la cola con su motivo. */
  rejected: number;
  /** Sigue sin haber red: se corta el barrido y se reintenta luego. */
  stalled: boolean;
}

/**
 * Vacía la cola en orden de captura.
 *
 * SECUENCIAL a propósito, no en paralelo: una captura puede depender de otra
 * anterior —el material que se dio de alta offline y el rollo que lo usa— y
 * mandarlas todas juntas las resolvería en cualquier orden.
 *
 * Al primer fallo de red se DETIENE. Seguir intentando las demás con la red
 * caída sólo sube el contador de intentos de todas por igual y no manda
 * ninguna; además, mandar la #3 sin haber mandado la #2 rompe el orden.
 */
export async function flushQueue(): Promise<FlushReport> {
  const report: FlushReport = { sent: 0, rejected: 0, stalled: false };

  if (!isQueueAvailable()) return report;

  for (const item of await listPending()) {
    try {
      const result = await QUEUE_KINDS[item.kind].send(item.payload);

      if (result.success) {
        await removeItem(item.id);
        report.sent += 1;
        continue;
      }

      // El servidor la rechazó. Se queda en la cola con el motivo a la vista
      // para que se corrija o se descarte a mano: borrarla sola perdería la
      // captura sin que nadie se entere.
      await markAttempt(item.id, result.error);
      report.rejected += 1;
    } catch {
      // Volvió a fallar la red: se para aquí y se conserva el orden.
      report.stalled = true;
      break;
    }
  }

  return report;
}
