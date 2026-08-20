import QRCode from "qrcode";

/**
 * Genera el QR de un rollo como SVG.
 *
 * Se hace en el SERVIDOR y como SVG, no como imagen: un SVG imprime nítido a
 * cualquier tamaño, y no suma nada al bundle del cliente. Una etiqueta que
 * sale pixelada no la lee el escáner con el rollo sucio de pelusa.
 *
 * El contenido es la liga corta `{APP_URL}/r/{code}`: cabe en un código menos
 * denso —más fácil de leer con la etiqueta arrugada— y la app de cámara del
 * sistema también puede abrirla.
 */
export async function generateLotQr(code: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/r/${encodeURIComponent(code)}`;

  return QRCode.toString(url, {
    type: "svg",
    // Nivel M: tolera hasta un 15% de daño. En una bodega la etiqueta se
    // ensucia y se raspa; el nivel L no aguantaría.
    errorCorrectionLevel: "M",
    margin: 1,
    // Sin ancho fijo: el SVG escala al contenedor y la hoja decide el tamaño.
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/** Varios QR de golpe, para la impresión por lote. */
export async function generateLotQrs(
  codes: string[],
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    codes.map(async (code) => [code, await generateLotQr(code)] as const),
  );

  return new Map(entries);
}

/**
 * QR de una PILA: lleva a la ficha del material.
 *
 * Apunta a la ficha y no a la lista filtrada porque parado frente a la estiba
 * lo que se quiere saber es QUÉ tela es —composición, ancho, tonos, cuánta
 * queda— y no sólo qué folios la componen. Desde la ficha se llega a los
 * rollos en un toque.
 *
 * Va por la liga corta `{APP_URL}/m/{código}`: cabe en un código menos denso,
 * que se lee mejor con la hoja arrugada, igual que el QR de cada rollo.
 */
export async function generatePileQr(params: {
  materialCode: string;
}): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  /* Cada tramo se codifica por separado: una clave con "/" adentro
     (TELA/AZUL) debe viajar como dos tramos de la ruta, no como un "%2F" que
     algunos lectores de QR y proxies devuelven decodificado y rompen. */
  const path = params.materialCode
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const url = `${baseUrl}/m/${path}`;

  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
