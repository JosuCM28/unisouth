/**
 * Un PDF para VERSE, no para descargarse.
 *
 * `inline` es la razón de existir de estas rutas: en el celular abre el visor
 * del teléfono, donde la hoja carta se ve completa y se le hace zoom con los
 * dedos, en vez de la página de impresión que no cabe en la pantalla.
 *
 * `private, no-store`: la hoja cambia con cada corte capturado y depende de
 * la sesión; un proxy compartido no debe guardarla ni servirla a otro.
 */
export function inlinePdfResponse(pdf: Buffer, fileName: string): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
