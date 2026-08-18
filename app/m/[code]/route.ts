import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

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
 */

/**
 * Sólo se aceptan códigos con el formato del sistema.
 *
 * Sin esta validación, `/m/..%2F..%2Fadmin` o un código con una URL completa
 * dentro convertiría este endpoint en un redirector abierto: un atacante
 * mandaría ligas que empiezan con el dominio de la fábrica y terminan en su
 * propio sitio de phishing.
 */
const VALID_CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const decoded = safeDecode(code);

  if (!decoded || !VALID_CODE.test(decoded)) {
    // Al catálogo, no a una página de error: un código inválido casi siempre
    // es una hoja mal leída, no un ataque.
    redirect("/materials");
  }

  redirect(`/materials/${encodeURIComponent(decoded.toUpperCase())}`);
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    // Un porcentaje mal formado revienta decodeURIComponent.
    return null;
  }
}
