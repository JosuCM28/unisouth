import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  photoId: string | null;
  /** Para el lector de pantalla: "Chamarra ignífuga", "Manga izquierda". */
  alt: string;
  className?: string;
  /** Qué se pinta cuando todavía no hay foto. */
  emptyLabel?: string;
}

/**
 * La foto de una prenda o de un marcado, o el hueco cuando no hay.
 *
 * En un solo lugar por dos razones. La primera es el hueco: sin él, una
 * cuadrícula donde unas prendas tienen foto y otras no se descuadra y hay que
 * leerla dos veces. La segunda es que aquí vive el `<img>` suelto de la app,
 * con su razón escrita una vez en vez de en cinco pantallas.
 */
export function GarmentPhoto({
  photoId,
  alt,
  className,
  emptyLabel = "Sin foto",
}: Props) {
  if (!photoId) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 border border-border bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-5" aria-hidden />
        <span className="text-xs">{emptyLabel}</span>
      </div>
    );
  }

  return (
    /* `<img>` y no `next/image`: la foto ya se reduce en el celular antes de
       subirse, y la ruta que la sirve exige sesión, así que el optimizador de
       Next no tendría nada que optimizar ni forma de entrar a leerla. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/garment-photos/${photoId}`}
      alt={alt}
      className={cn("object-cover", className)}
      loading="lazy"
    />
  );
}
