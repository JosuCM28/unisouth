import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { readFileByKey } from "@/lib/core/storage";

/**
 * Entrega la foto de una orden.
 *
 * Pasa por la app y no por una carpeta pública del servidor, y eso es
 * deliberado: estas imágenes son los papeles del cliente —sus cantidades, sus
 * precios a veces, su sello— y una URL pública las deja al alcance de
 * cualquiera que la adivine o la reciba reenviada. Aquí no se sirve un solo
 * byte sin sesión.
 *
 * Pide `orders:browse` y no `inventory:write`: quien contesta el teléfono
 * cuando el cliente pregunta necesita VER el papel, aunque no capture nada.
 * Es la misma llave que abre la orden, así que quien llegó a la pantalla puede
 * abrir sus fotos, y quien no, tampoco las baja.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  await requirePermission("orders:browse");

  const { id, photoId } = await params;

  const attachment = await prisma.attachment.findUnique({
    where: { id: photoId },
    select: {
      storageKey: true,
      name: true,
      mimeType: true,
      cuttingOrderId: true,
    },
  });

  if (!attachment || !attachment.storageKey) {
    return new Response("Foto no encontrada", { status: 404 });
  }

  /* Que la foto sea DE ESTA orden. La id de la orden viene de la URL y sin
     esta comprobación serviría cualquier adjunto del sistema —el de un rollo,
     el de una requisición— con sólo poner su id en la ruta. */
  if (attachment.cuttingOrderId !== id) {
    return new Response("Foto no encontrada", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFileByKey(attachment.storageKey);
  } catch {
    /* El registro existe pero el archivo no. Pasa si se subió sin el volumen
       montado y un despliegue se lo llevó. Se contesta 404 y no 500: no es un
       fallo del servidor, es una foto que ya no está, y la pantalla lo pinta
       como imagen rota en vez de tumbar la ficha entera. */
    return new Response("El archivo ya no está en el almacén", { status: 404 });
  }

  /* `inline` para verla en el visor, `attachment` para bajarla. Lo elige la
     pantalla con `?download=1`, porque el mismo archivo sirve para las dos y
     duplicar la ruta sólo para cambiar una cabecera no tendría sentido. */
  const download = new URL(request.url).searchParams.get("download") === "1";
  const disposition = download ? "attachment" : "inline";

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType ?? "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(attachment.name)}"`,
      /* Privada y de larga vida: el contenido de una foto NUNCA cambia —se
         sube o se borra, no se edita— así que el navegador puede quedársela.
         `private` impide que un proxy compartido la guarde para otro. */
      "Cache-Control": "private, max-age=31536000, immutable",
      // Que el navegador no "adivine" el tipo: una imagen se pinta como
      // imagen y nunca se interpreta como otra cosa.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
