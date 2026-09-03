import { requirePermission } from "@/lib/core/session";
import { GarmentRepository } from "@/lib/repositories/garment.repository";

/**
 * Sirve los bytes de una foto de prenda.
 *
 * Es el ÚNICO punto de la app que lee el BYTEA. Las listas traen sólo el id de
 * la foto, y el navegador pide cada imagen por su cuenta: así una carpeta de
 * cuarenta prendas no baja doce megabytes de golpe, las que no se ven nunca se
 * piden, y el navegador puede cachearlas.
 *
 * Pasa por Next y no por un CDN porque el CSP de la app es `img-src 'self'` y
 * porque una foto de la ficha de un cliente no debe quedar accesible a quien
 * adivine una URL: aquí se exige sesión con permiso de recorrer el almacén.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requirePermission("inventory:browse");

  const { id } = await params;

  const repository = new GarmentRepository();
  const photo = await repository.findPhotoData(id);

  if (!photo) {
    return new Response("Foto no encontrada", { status: 404 });
  }

  /* `immutable` y un año de caché: el id de una foto NUNCA cambia de
     contenido. Reemplazar la foto de una prenda crea una fila nueva con otro
     id y borra la vieja, así que el navegador no puede quedarse pegado a una
     imagen vieja por cachearla. Eso es lo que hace que abrir la carpeta por
     segunda vez no vuelva a pedir nada.

     `private` porque la respuesta depende de la sesión: sin él, un proxy
     compartido podría servirle esta foto a alguien sin permiso. */
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.data.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      // La foto se pinta, no se descarga, y nunca se interpreta como otra cosa.
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
