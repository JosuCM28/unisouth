"use client";

import type { ActionResult } from "@/lib/core/result";
import { createLotAction } from "@/app/actions/lot.actions";
import { createMaterialAction } from "@/app/actions/material.actions";
import { createProductAction } from "@/app/actions/product.actions";
import { createClientAction } from "@/app/actions/client.actions";
import { createLocationAction } from "@/app/actions/location.actions";
import { syncOfflineIssueAction } from "@/app/actions/offline.actions";
import { QUEUE_KIND_LABELS } from "@/lib/constants/labels";
import type { QueueKind } from "./queue";

/**
 * Qué Server Action le toca a cada tipo de captura encolada.
 *
 * Es un diccionario y no un `switch`: agregar un tipo encolable nuevo es
 * agregar una entrada aquí, sin tocar el reenviador. Misma idea que
 * MOVEMENT_STRATEGIES en el inventario.
 *
 * Altas, y UNA excepción que mueve saldo: la salida sin conexión. Recuentos
 * y traspasos siguen sin encolarse. La salida sí se puede porque al subirla
 * no se manda "a ciegas": `createAndApplyOffline` vuelve a bloquear cada
 * rollo y, si ya no alcanza, rechaza la salida entera y no descuenta nada.
 * Así un corte de 50 m contra un rollo que ya sólo tiene 30 nunca llega al
 * kárdex; se queda en el celular, en rojo, para corregirse.
 */
interface QueueKindConfig {
  /** La misma action que llamaría el formulario si hubiera conexión. */
  send: (payload: unknown) => Promise<ActionResult<unknown>>;
  /** Cómo se nombra en la lista de pendientes. */
  label: string;
}

export const QUEUE_KINDS: Record<QueueKind, QueueKindConfig> = {
  "lot.create": { send: createLotAction, label: QUEUE_KIND_LABELS["lot.create"] },
  "material.create": { send: createMaterialAction, label: QUEUE_KIND_LABELS["material.create"] },
  "product.create": { send: createProductAction, label: QUEUE_KIND_LABELS["product.create"] },
  "client.create": { send: createClientAction, label: QUEUE_KIND_LABELS["client.create"] },
  "location.create": { send: createLocationAction, label: QUEUE_KIND_LABELS["location.create"] },
  "issue.create": { send: syncOfflineIssueAction, label: QUEUE_KIND_LABELS["issue.create"] },
};
