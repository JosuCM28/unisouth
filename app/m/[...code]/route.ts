import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { materialPath } from "@/lib/material-url";

/**
 * Redirección corta del QR de una PILA.
 *
 * El QR de la hoja de pila contiene {APP_URL}/m/{código}: una liga corta cabe
 * en un código menos denso, que se lee mejor con la hoja arrugada o sucia de
 * pelusa. Es el equivalente de `/r/{folio}` para rollos sueltos.
 *
 * No exige sesión a propósito —el destino sí la exige, vía proxy.ts— para que
 * la app de cámara del sistema pueda abrirlo y el usuario caiga en el login
 * con su `?redirect` puesto.
 *
 * Es catch-all y no un segmento simple porque la clave de un material admite
 * "/" (TELA/AZUL). Con `[code]` esa hoja daba 404 al escanearla, aunque el
 * material existiera.
 */

/**
 * Qué se acepta como clave de material.
 *
 * Se permite lo mismo que valida `materialSchema`: hasta 40 caracteres sin
 * espacios. Lo que NO se permite es que la clave traiga "..", "\" o "//",
 * porque entonces `/m/..%2F..%2Fadmin` o una clave con una URL completa
 * adentro convertiría este endpoint en un redirector abierto: un atacante
 * mandaría ligas que empiezan con el dominio de la fábrica y terminan en su
 * propio sitio de phishing.
 */
const VALID_CODE = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,39}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string[] }> },
) {
  const { code } = await params;
  const decoded = safeDecode(code);

  if (!decoded || !isSafe(decoded)) {
    // Al catálogo, no a una página de error: un código inválido casi siempre
    // es una hoja mal leída, no un ataque.
    redirect("/materials");
  }

  redirect(materialPath(decoded));
}

/**
 * Junta los tramos de la ruta en una sola clave.
 *
 * Next parte por "/" antes de que este código corra, así que una clave que
 * viajó sin codificar llega como ["TELA", "AZUL"] y hay que volverla a unir.
 */
function safeDecode(segments: string[]): string | null {
  try {
    const joined = segments
      .map((segment) => decodeURIComponent(segment))
      .join("/")
      .trim();

    return joined.length > 0 ? joined.toUpperCase() : null;
  } catch {
    // Un porcentaje mal formado revienta decodeURIComponent.
    return null;
  }
}

function isSafe(code: string): boolean {
  if (!VALID_CODE.test(code)) return false;
  // Recorrido de rutas y barras dobles: nunca son parte de una clave real.
  return !code.includes("..") && !code.includes("//");
}
