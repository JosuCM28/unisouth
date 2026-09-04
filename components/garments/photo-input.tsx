"use client";

import { useRef, useState } from "react";
import { Camera, ImageOff, ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PhotoInput as Photo } from "@/lib/validations/garment.schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
 *
 * Hay DOS caminos y dos `<input>` separados, no uno solo. El de la cámara lleva
 * `capture="environment"`, que en el celular le ordena al navegador abrir la
 * cámara SALTÁNDOSE el selector de archivos: perfecto para fotografiar la
 * prenda que se tiene enfrente, e inútil cuando la foto ya está en la galería o
 * llegó por WhatsApp. Son dos elementos y no un atributo que se prende y apaga
 * porque cambiar `capture` sobre el mismo input no es fiable en los navegadores
 * de Android: varios siguen abriendo la cámara con el atributo ya quitado.
 */
export function PhotoInput({
  label,
  value,
  onChange,
  currentPhotoId,
  hint,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const preview = previewOf(value, currentPhotoId);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Eso no es una imagen. Elige un archivo JPG, PNG o WebP.");
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
      /* Se limpian los inputs para que elegir DOS VECES el mismo archivo vuelva
         a disparar el evento: sin esto, quitar la foto y volver a elegir la
         misma no hace nada y parece que la app se trabó. */
      if (cameraRef.current) cameraRef.current.value = "";
      if (libraryRef.current) libraryRef.current.value = "";
    }
  }

  /* Arrastrar y soltar es para el escritorio, donde la foto llega de una
     carpeta o de un correo y abrir el explorador es un paso de más. En el
     celular estos eventos no se disparan, así que no estorban. */
  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>

      <div className="flat-surface flex items-center gap-3 p-2">
        <div
          className={cn(
            "flex size-20 shrink-0 items-center justify-center border bg-muted transition-colors",
            isDragging ? "border-primary bg-primary/10" : "border-border",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
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
            ref={cameraRef}
            type="file"
            accept="image/*"
            /* Abre la cámara trasera en el celular en vez del carrete: la foto
               se toma delante de la prenda, no se busca entre las viejas. */
            capture="environment"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          <input
            ref={libraryRef}
            type="file"
            /* SIN `capture`: éste es el que abre la galería del celular o el
               explorador de la computadora, para las fotos que ya existen. */
            accept="image/*"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="touch-target w-full"
              disabled={isReading}
              onClick={() => cameraRef.current?.click()}
            >
              {isReading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Camera className="size-4" aria-hidden />
              )}
              {cameraLabel(isReading, Boolean(preview))}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="touch-target w-full"
              disabled={isReading}
              onClick={() => libraryRef.current?.click()}
            >
              <ImageUp className="size-4" aria-hidden />
              Elegir archivo
            </Button>
          </div>

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

/** Qué dice el botón de la cámara según en qué está el campo. */
function cameraLabel(isReading: boolean, hasPhoto: boolean): string {
  if (isReading) return "Preparando…";

  return hasPhoto ? "Cambiar" : "Tomar foto";
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
