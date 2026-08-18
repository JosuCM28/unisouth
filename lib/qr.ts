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
 * QR de una PILA: apunta al inventario ya filtrado por ese material.
 *
 * No lleva a un rollo concreto —una pila no es una pieza— sino a la lista de
 * todo lo que hay de esa clave, con su existencia y sus ubicaciones. Es lo
 * que se quiere ver con el teléfono parado frente a la estiba.
 */
export async function generatePileQr(params: {
  materialId: string;
  clientId?: string;
  locationId?: string;
}): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const query = new URLSearchParams({ materialId: params.materialId });

  // Se conserva el mismo recorte con el que se imprimió: si la hoja es de la
  // tela de un cliente, el QR no debe abrir la de todos.
  if (params.clientId) query.set("clientId", params.clientId);
  if (params.locationId) query.set("locationId", params.locationId);

  return QRCode.toString(`${baseUrl}/lots?${query}`, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
