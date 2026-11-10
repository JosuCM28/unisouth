import {
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/core/errors";

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

const STATUS_BY_ERROR: [new (...args: never[]) => DomainError, number][] = [
  [UnauthorizedError, 401],
  [ForbiddenError, 403],
  [NotFoundError, 404],
];

/**
 * Una ruta que devuelve un archivo no tiene `executeAction` que traduzca el
 * error: sin esto, "no es tu vale" saldría como un 500 genérico.
 */
export function pdfErrorResponse(error: unknown): Response {
  if (!(error instanceof DomainError)) throw error;

  const match = STATUS_BY_ERROR.find(([type]) => error instanceof type);
  return new Response(error.message, {
    status: match ? match[1] : 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
