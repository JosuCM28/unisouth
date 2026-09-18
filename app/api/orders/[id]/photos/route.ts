import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/core/session";
import { enforceRateLimit, WRITE_LIMIT } from "@/lib/core/rate-limit";
import {
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/core/errors";
import { AttachmentService } from "@/lib/services/attachment.service";
import { MAX_ATTACHMENT_BYTES } from "@/lib/validations/attachment.schema";

/**
 * Sube una foto a una orden.
 *
 * Va como RUTA y no como Server Action, que es lo que usa el resto del
 * sistema para escribir. Las acciones traen un tope de cuerpo pensado para
 * formularios de texto y una imagen lo roza: subirla por ahí funciona hasta
 * el día que alguien manda una foto un poco más grande y falla con un error
 * que no dice nada. Una ruta recibe el binario sin ese techo.
 *
 * Lo que NO cambia es la barrera: el permiso se exige igual que en cualquier
 * acción, y antes de tocar nada. Esconder el botón en la pantalla es
 * comodidad; esto es la seguridad.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Escribe en disco: sin tope, un bucle llena el volumen del VPS.
    await enforceRateLimit("upload:photo", WRITE_LIMIT);
    const user = await requirePermission("inventory:write");

    const { id } = await params;

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { success: false, error: "No llegó ninguna imagen." },
        { status: 400 },
      );
    }

    /* El tamaño se revisa ANTES de leer los bytes a memoria. Leer primero y
       preguntar después significa cargar el archivo entero al servidor para
       tirarlo, que es justo lo que un abuso querría hacer. */
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return Response.json(
        {
          success: false,
          error: `La imagen pesa más de ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB.`,
        },
        { status: 413 },
      );
    }

    const attachment = await new AttachmentService({
      userId: user.id,
      userName: user.name,
    }).upload({
      orderId: id,
      filename: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });

    // La ficha de la orden pinta la galería en el servidor: sin esto la foto
    // no aparece hasta que alguien recarga a mano.
    revalidatePath(`/orders/${id}`);

    return Response.json({
      success: true,
      data: {
        id: attachment.id,
        name: attachment.name,
        sizeBytes: attachment.sizeBytes,
        createdAt: attachment.createdAt,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Traduce el error a una respuesta, con el mismo criterio que `executeAction`.
 *
 * No se puede reusar aquél: devuelve un `ActionResult` para una Server Action,
 * no una `Response` con su código HTTP. Lo que sí se respeta es la regla que
 * importa: un `DomainError` trae un mensaje ya redactado para el usuario y se
 * muestra tal cual; cualquier otra cosa es un bug y se queda en el servidor,
 * porque un error de Postgres en pantalla filtra detalles internos.
 */
function errorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return Response.json(
      { success: false, error: error.message },
      { status: statusFor(error) },
    );
  }

  console.error("[POST /api/orders/:id/photos] Error no controlado:", error);

  return Response.json(
    {
      success: false,
      error:
        "Ocurrió un error inesperado. Intenta de nuevo o avisa al administrador.",
    },
    { status: 500 },
  );
}

function statusFor(error: DomainError): number {
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof NotFoundError) return 404;
  // Reglas de negocio y validaciones: la petición se entendió, pero no procede.
  return 400;
}
