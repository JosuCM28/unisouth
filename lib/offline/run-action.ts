"use client";

import type { ActionResult } from "@/lib/core/result";

/**
 * Ejecuta una Server Action sin que un fallo de red deje el formulario colgado.
 *
 * Una action que llega al servidor siempre devuelve un ActionResult, pero si
 * no hay red la promesa se RECHAZA y nunca se llega al `if (!result.success)`:
 * el botón se queda en "Guardando…" para siempre, sin toast y sin mensaje. En
 * una bodega con WiFi intermitente eso pasa varias veces al día.
 *
 * NO ENCOLA, y ésa es la diferencia con `submitOrQueue`: esto es para lo que
 * depende de un saldo que no se puede releer sin conexión. Mandar a ciegas un
 * corte de 50 m contra un rollo que ya sólo tiene 30 corrompería el kárdex.
 */
export async function runAction<T>(
  call: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await call();
  } catch (error) {
    // Aquí caen dos cosas distintas —el WiFi caído y un bug de la pantalla— y
    // al usuario se le dice lo mismo en ambas. El rastro es para distinguirlas.
    console.error("[runAction] La acción no llegó al servidor:", error);

    return {
      success: false,
      error:
        "No se pudo guardar. Revisa la conexión e intenta de nuevo; no se registró nada.",
      code: "NETWORK_ERROR",
    };
  }
}
