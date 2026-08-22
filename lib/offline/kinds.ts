"use client";

import type { ActionResult } from "@/lib/core/result";
import { createLotAction } from "@/app/actions/lot.actions";
import { createMaterialAction } from "@/app/actions/material.actions";
import { createProductAction } from "@/app/actions/product.actions";
import { createClientAction } from "@/app/actions/client.actions";
import { createLocationAction } from "@/app/actions/location.actions";
import type { QueueKind } from "./queue";

/**
 * Qué Server Action le toca a cada tipo de captura encolada.
 *
 * Es un diccionario y no un `switch`: agregar un tipo encolable nuevo es
 * agregar una entrada aquí, sin tocar el reenviador. Misma idea que
 * MOVEMENT_STRATEGIES en el inventario.
 *
 * SÓLO altas. Nada que dependa de un saldo —cortes, recuentos, traspasos—
 * se encola: sin conexión no se puede leer el metraje vivo del rollo, y
 * mandar a ciegas un corte de 50 m contra un rollo que ya sólo tiene 30
 * corrompería el kárdex. Esas operaciones fallan de frente y se reintentan
 * con el dato a la vista.
 */
interface QueueKindConfig {
  /** La misma action que llamaría el formulario si hubiera conexión. */
  send: (payload: unknown) => Promise<ActionResult<unknown>>;
  /** Cómo se nombra en la lista de pendientes. */
  label: string;
}

export const QUEUE_KINDS: Record<QueueKind, QueueKindConfig> = {
  "lot.create": { send: createLotAction, label: "Rollo" },
  "material.create": { send: createMaterialAction, label: "Material" },
  "product.create": { send: createProductAction, label: "Producto" },
  "client.create": { send: createClientAction, label: "Cliente" },
  "location.create": { send: createLocationAction, label: "Ubicación" },
};
