import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

/**
 * Redirección corta del QR.
 *
 * El QR de cada rollo contiene {APP_URL}/r/{code}: una liga corta cabe en un
 * código menos denso, que se lee mejor con la etiqueta arrugada o sucia.
 *
 * No exige sesión a propósito —el destino sí la exige, vía proxy.ts— para que
 * la app de cámara del sistema pueda abrirlo y el usuario caiga en el login
 * con su `?redirect` puesto.
 */

/**
 * Sólo se aceptan folios con el formato del sistema.
 *
 * Sin esta validación, `/r/..%2F..%2Fadmin` o un folio con una URL completa
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
    // A una lista de inventario, no a una página de error: el folio inválido
    // casi siempre es una etiqueta mal leída, no un ataque.
    redirect("/lots");
  }

  redirect(`/lots/${encodeURIComponent(decoded.toUpperCase())}`);
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    // Un porcentaje mal formado revienta decodeURIComponent.
    return null;
  }
}
