import { StickyNote } from "lucide-react";
import { cn, contrastText } from "@/lib/utils";

/** Lo que se le anotó a una talla al levantar la orden. */
export interface SizeAnnotation {
  /** El texto libre del renglón: "va sin bolsa", "forro azul"… */
  note?: string | null;
  /** La etiqueta de corte del renglón, con su color. */
  tag?: { name: string; color: string } | null;
}

/**
 * El papelito del foleo: el color con su nombre encima.
 *
 * Se saca de `SizeNote` porque ahora se pinta también suelto —un bulto puede
 * llevar su propio foleo, y una talla con bultos de dos colores enseña los
 * dos— y tener el chip escrito en dos lados es cómo acaban siendo dos chips
 * distintos.
 */
export function CutTagChip({
  tag,
  className,
}: {
  tag: { name: string; color: string };
  className?: string;
}) {
  return (
    <span
      className={cn("shrink-0 px-1 py-0.5 leading-tight", className)}
      style={{ backgroundColor: tag.color, color: contrastText(tag.color) }}
    >
      {tag.name}
    </span>
  );
}

/**
 * La anotación de una talla, en chiquito y al lado de su número.
 *
 * Existe porque la instrucción del renglón —"va sin bolsa", la etiqueta
 * URGENTE— se escribe al levantar la orden y hasta ahora sólo se leía en la
 * sección de Tallas. Quien captura el corte está en la mesa mirando el
 * diálogo, y tener que salirse a otra pantalla para recordar qué llevaba la 42
 * es justo cuando se corta mal.
 *
 * Se repite en la captura y en el corte ya guardado a propósito: la misma
 * instrucción tiene que poder leerse antes de teclear y después, al revisar lo
 * que se capturó.
 */
export function SizeNote({
  note,
  tag,
  className,
}: SizeAnnotation & { className?: string }) {
  if (!note && !tag) return null;

  return (
    <span
      className={cn(
        "flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      {tag && <CutTagChip tag={tag} />}

      {note && (
        <>
          <StickyNote className="mt-0.5 size-3 shrink-0" aria-hidden />
          {/* `whitespace-pre-wrap`: la nota se teclea con sus renglones y
              respetarlos es lo que la hace legible. */}
          <span className="min-w-0 whitespace-pre-wrap break-words">
            {note}
          </span>
        </>
      )}
    </span>
  );
}
