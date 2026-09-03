"use client";

import { useRef, useState } from "react";
import { Camera, ImageOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PhotoInput as Photo } from "@/lib/validations/garment.schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Lo que el formulario decide hacer con la foto.
 *
 * Tres estados y no dos: mandar una nueva, quitar la que había, o no tocarla.
 * Sin el tercero, editar el nombre de una prenda le borraría la foto —el error
 * que sólo se descubre cuando alguien la busca días después.
 */
export type PhotoValue = Photo | "remove" | "keep";

/** Lado largo al que se reduce antes de subir. */
const MAX_SIDE = 1600;

/** Calidad del JPEG resultante. */
const QUALITY = 0.82;

interface Props {
  label: string;
  value: PhotoValue;
  onChange: (value: PhotoValue) => void;
  /** La foto que ya tenía, para pintarla mientras no se cambie. */
  currentPhotoId?: string | null;
  hint?: string;
}

/**
 * Toma o elige una foto, la reduce EN EL CELULAR y la deja lista para subir.
 *
 * La reducción es lo que hace viable guardar las fotos en la base: una del
 * teléfono son 4 MB y 4 000 píxeles de ancho, cuando la pantalla que la va a
 * enseñar mide 400. Reducirla aquí y no en el servidor tiene una razón de
 * piso: la bodega sube por datos móviles, y mandar 4 MB para que el servidor
 * los tire es un minuto de espera y el saldo de alguien.
 *
 * Se convierte SIEMPRE a JPEG, incluso si llegó PNG: una foto de una prenda no
 * tiene transparencia que perder, y el PNG de una cámara pesa varias veces más
 * sin verse mejor.
 */
export function PhotoInput({
  label,
  value,
  onChange,
  currentPhotoId,
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isReading, setIsReading] = useState(false);

  const preview = previewOf(value, currentPhotoId);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Eso no es una imagen. Elige una foto.");
      return;
    }

    setIsReading(true);

    try {
      onChange(await downscale(file));
    } catch (error) {
      console.error("[PhotoInput] No se pudo leer la foto:", error);
      toast.error("No se pudo leer la foto. Intenta con otra.");
    } finally {
      setIsReading(false);
      /* Se limpia el input para que elegir DOS VECES el mismo archivo vuelva a
         disparar el evento: sin esto, quitar la foto y volver a elegir la misma
         no hace nada y parece que la app se trabó. */
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>

      <div className="flat-surface flex items-center gap-3 p-2">
        <div className="flex size-20 shrink-0 items-center justify-center border border-border bg-muted">
          {preview ? (
            /* `<img>` y no `next/image`: la foto ya viene reducida desde el
               celular y la ruta que la sirve exige sesión, así que el
               optimizador no tendría nada que optimizar ni podría entrar. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageOff className="size-6 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            /* Abre la cámara trasera en el celular en vez del carrete: la foto
               se toma delante de la prenda, no se busca entre las viejas. */
            capture="environment"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          <Button
            type="button"
            variant="outline"
            className="touch-target w-full"
            disabled={isReading}
            onClick={() => inputRef.current?.click()}
          >
            {isReading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Camera className="size-4" aria-hidden />
            )}
            {buttonLabel(isReading, Boolean(preview))}
          </Button>

          {preview && (
            <Button
              type="button"
              variant="ghost"
              className="touch-target w-full"
              onClick={() => onChange("remove")}
            >
              <Trash2 className="size-4" aria-hidden />
              Quitar
            </Button>
          )}
        </div>
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Qué dice el botón según en qué está el campo. */
function buttonLabel(isReading: boolean, hasPhoto: boolean): string {
  if (isReading) return "Preparando…";

  return hasPhoto ? "Cambiar foto" : "Tomar foto";
}

/**
 * Qué se está viendo ahora mismo.
 *
 * La recién elegida gana sobre la guardada, y "quitar" gana sobre las dos:
 * lo que se pinta es lo que va a quedar al guardar, no lo que hay hoy.
 */
function previewOf(
  value: PhotoValue,
  currentPhotoId?: string | null,
): string | null {
  if (typeof value === "object") return value.dataUrl;
  if (value === "remove") return null;

  return currentPhotoId ? `/api/garment-photos/${currentPhotoId}` : null;
}

/**
 * Reduce la imagen a `MAX_SIDE` en su lado largo y la devuelve como data URL.
 *
 * Va por `createImageBitmap` y no por `new Image()` con un `onload`: el bitmap
 * respeta la orientación EXIF del teléfono, y sin eso las fotos tomadas en
 * vertical se guardaban acostadas.
 */
async function downscale(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no dio contexto 2D");

    /* Fondo blanco antes de dibujar: un PNG con transparencia acaba en JPEG,
       que no la tiene, y sin esto esas zonas salen negras. */
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL("image/jpeg", QUALITY),
      mimeType: "image/jpeg",
      width,
      height,
    };
  } finally {
    // Libera la memoria del bitmap: en un celular con varias fotos seguidas,
    // no cerrarlos es lo que acaba tirando la pestaña.
    bitmap.close();
  }
}
