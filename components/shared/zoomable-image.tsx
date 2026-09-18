"use client";

import { useCallback, useRef, useState } from "react";
import { Minus, Plus, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  src: string;
  alt: string;
  className?: string;
}

/** Hasta dónde se puede acercar. Seis veces basta para un número borroso. */
const MAX_SCALE = 6;
const MIN_SCALE = 1;
/** Cuánto acerca cada toque del botón. */
const STEP = 1.6;
/** Milisegundos entre dos toques para que cuenten como doble. */
const DOUBLE_TAP_MS = 300;
/** Cuánto se puede mover el dedo sin dejar de ser un toque. */
const TAP_SLOP = 8;
/** Y cuán cerca del toque anterior tiene que caer el segundo. */
const DOUBLE_TAP_RADIUS = 40;

interface Point {
  x: number;
  y: number;
}

/** Cómo se está mirando la imagen: cuánto se acercó y hacia dónde se movió. */
interface View {
  scale: number;
  x: number;
  y: number;
}

/**
 * Una imagen que se puede acercar: con los dedos, con la rueda o con botones.
 *
 * Se implementa a mano y no con una librería porque el pellizco del NAVEGADOR
 * está apagado en toda la app —`userScalable: false`, para que el zoom
 * accidental no estorbe cuando se captura con una mano— y esa misma decisión
 * deja sin gesto nativo a la única pantalla donde acercarse sí hace falta: la
 * foto de un papel escrito a mano, que es para lo que se guarda.
 *
 * Los botones no son decoración ni un respaldo del gesto: en el piso esto se
 * usa con guantes, y un pellizco con guante de carnaza no siempre registra los
 * dos dedos.
 *
 * El transform es `translate` y luego `scale` con el origen en la esquina, no
 * en el centro: así la cuenta para dejar fijo el punto que está bajo el dedo
 * es una resta y no depende del tamaño de la caja.
 */
export function ZoomableImage(props: Props) {
  /* La `key` es lo que devuelve el zoom a su sitio al cambiar de foto: React
     remonta y el estado nace limpio. Antes era un efecto que llamaba a
     `setScale`, que pinta dos veces cada vez que se abre una imagen —y deja
     ver el acercamiento de la anterior en el primer cuadro—.

     Se pone AQUÍ y no en quien lo usa para que no se pueda olvidar: un visor
     que abre la segunda foto acercada al 300% parece descompuesto. */
  return <Zoomable key={props.src} {...props} />;
}

function Zoomable({ src, alt, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  /* Escala y desplazamiento en UN solo estado, no en dos.

     No es cosmético. Antes eran dos, y para acercar anclado había que llamar
     a `setOffset` dentro del updater de `setScale` —el desplazamiento nuevo
     depende de la escala nueva—. Eso vuelve impuro al updater, y React lo
     invoca dos veces a propósito para delatarlo: el zoom se aplicaba DOBLE,
     y la imagen se iba de lado en cada rueda. Juntos, un updater puro los
     calcula a la vez. */
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const { scale } = view;
  const offset: Point = { x: view.x, y: view.y };

  /* Los dedos que están tocando, por id. En un mapa y no en estado porque
     cambian en cada movimiento y volver a pintar por cada uno haría el
     arrastre a tirones. */
  const pointers = useRef(new Map<number, Point>());
  /* La distancia entre dos dedos en el cuadro anterior. Sin ella no se puede
     saber si el pellizco abre o cierra. */
  const pinchDistance = useRef<number | null>(null);
  /* Cuándo y DÓNDE fue el último toque suelto. El lugar importa: dos toques
     seguidos en esquinas distintas de la foto no son un doble toque, son dos
     toques con prisa. */
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);
  /* Dónde empezó el dedo y cuánto se movió. Un arrastre que termina NO es un
     toque: sin esto, arrastrar la foto dos veces seguidas se leía como doble
     toque y devolvía el zoom al 100% justo cuando se estaba mirando algo. */
  const gestureStart = useRef<Point | null>(null);
  const gestureMoved = useRef(0);

  /* Si hay dedos encima AHORA MISMO. En estado y no en un ref porque decide
     lo que se pinta —la transición del transform— y lo que se pinta no puede
     salir de un ref: React no vuelve a pintar cuando un ref cambia, así que
     la transición se quedaría pegada en el valor del primer render. */
  const [isGesturing, setIsGesturing] = useState(false);

  /** Vuelve al tamaño original. Lo usan el botón y el doble toque. */
  const reset = useCallback(() => {
    setView({ scale: 1, x: 0, y: 0 });
  }, []);

  /**
   * Impide que la imagen se arrastre fuera de la vista.
   *
   * Sin esto se puede empujar hasta dejar la caja en blanco, y desde ahí no
   * hay forma de saber hacia dónde regresar. Al tamaño original se centra:
   * cualquier desplazamiento sobraría.
   */
  const clamp = useCallback((next: Point, nextScale: number): Point => {
    const image = imageRef.current;
    if (!image || nextScale <= 1) return { x: 0, y: 0 };

    /* `offsetWidth` y no `getBoundingClientRect`: el primero da el tamaño de
       maquetación, ajeno al transform, que es justo la base sobre la que la
       escala se multiplica. El segundo ya viene escalado y la cuenta se
       mordería la cola. */
    const width = image.offsetWidth;
    const height = image.offsetHeight;

    const overflowX = Math.max(0, width * nextScale - width);
    const overflowY = Math.max(0, height * nextScale - height);

    return {
      x: Math.min(0, Math.max(-overflowX, next.x)),
      y: Math.min(0, Math.max(-overflowY, next.y)),
    };
  }, []);

  /**
   * Acerca dejando FIJO el punto que está bajo el dedo o el cursor.
   *
   * Es la diferencia entre una lupa y un salto: si el zoom se anclara al
   * centro, acercarse a una esquina la mandaría fuera de la pantalla y habría
   * que ir a buscarla arrastrando.
   *
   * @param resolve Recibe la escala VIGENTE y devuelve la nueva.
   *
   * Una función y no un número: la rueda del ratón dispara varios eventos en
   * el mismo cuadro, y si cada uno calculara su destino con la escala del
   * render anterior —que todavía no se actualiza— los tres pedirían lo mismo
   * y sólo se aplicaría un paso. Dentro del updater, cada uno parte de donde
   * dejó el anterior.
   */
  const zoomAt = useCallback(
    (resolve: (current: number) => number, focus: Point) => {
      setView((current) => {
        const target = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, resolve(current.scale)),
        );
        if (target === current.scale) return current;

        // Un updater PURO: calcula, no dispara otro cambio de estado.
        const moved = clamp(
          {
            x: focus.x - ((focus.x - current.x) * target) / current.scale,
            y: focus.y - ((focus.y - current.y) * target) / current.scale,
          },
          target,
        );

        return { scale: target, x: moved.x, y: moved.y };
      });
    },
    [clamp],
  );

  /**
   * El punto, medido desde la esquina de la IMAGEN sin transformar.
   *
   * No desde la esquina de la caja, que es el error fácil: la imagen va
   * CENTRADA, así que entre una esquina y la otra hay un hueco. Y el `offset`
   * vive en el sistema de la imagen —el transform es suyo—, de modo que
   * mezclar los dos sistemas mete ese hueco en la cuenta del anclaje y el
   * zoom se va de lado. Con una foto vertical en una caja ancha el hueco son
   * cientos de píxeles y el punto que se quería mirar acaba fuera.
   *
   * La esquina sin transformar se deduce de la pintada: `scale` con el origen
   * en la esquina no la mueve, así que basta con quitarle el desplazamiento.
   */
  function toImageSpace(point: { clientX: number; clientY: number }): Point {
    const image = imageRef.current;
    if (!image) return { x: 0, y: 0 };

    const rect = image.getBoundingClientRect();
    return {
      x: point.clientX - (rect.left - offset.x),
      y: point.clientY - (rect.top - offset.y),
    };
  }

  /** El centro de lo que se ve, en el mismo sistema. El ancla de los botones. */
  function center(): Point {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return toImageSpace({
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
  }

  function handlePointerDown(event: React.PointerEvent) {
    /* Se captura para seguir recibiendo el movimiento aunque el dedo salga
       de la imagen: al arrastrar acercado eso pasa todo el tiempo.

       En try/catch porque lanza si el puntero ya no esta activo —se solto
       entre el evento y esta linea— y si lanzara aqui se llevaria por delante
       el registro de abajo: el gesto quedaria a medias, sin dedo anotado, y
       el arrastre se leeria despues como un toque. */
    try {
      (event.target as Element).setPointerCapture?.(event.pointerId);
    } catch {
      // Sin captura se sigue pudiendo arrastrar; solo se pierde el seguimiento
      // cuando el dedo sale del elemento.
    }
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    setIsGesturing(true);

    if (pointers.current.size === 1) {
      gestureStart.current = { x: event.clientX, y: event.clientY };
      gestureMoved.current = 0;
    }
  }

  function handlePointerMove(event: React.PointerEvent) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;

    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (gestureStart.current) {
      gestureMoved.current = Math.max(
        gestureMoved.current,
        Math.hypot(
          current.x - gestureStart.current.x,
          current.y - gestureStart.current.y,
        ),
      );
    }

    const touches = [...pointers.current.values()];

    // Dos dedos: pellizco.
    if (touches.length === 2) {
      const [a, b] = touches as [Point, Point];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);

      if (pinchDistance.current !== null && pinchDistance.current > 0) {
        const midpoint = toImageSpace({
          clientX: (a.x + b.x) / 2,
          clientY: (a.y + b.y) / 2,
        });
        const ratio = distance / pinchDistance.current;
        zoomAt((current) => current * ratio, midpoint);
      }

      pinchDistance.current = distance;
      return;
    }

    // Un dedo y acercado: arrastre. Al tamaño original no hay nada que mover,
    // y capturarlo impediría el desplazamiento normal de la pantalla.
    if (touches.length === 1 && scale > 1) {
      setView((currentView) => {
        const moved = clamp(
          {
            x: currentView.x + (current.x - previous.x),
            y: currentView.y + (current.y - previous.y),
          },
          currentView.scale,
        );

        return { ...currentView, x: moved.x, y: moved.y };
      });
    }
  }

  function handlePointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchDistance.current = null;
    if (pointers.current.size === 0) setIsGesturing(false);

    /* Doble toque para acercar y para volver. Se detecta a mano porque
       `dblclick` no llega de forma fiable desde una pantalla táctil, y es el
       gesto que la gente prueba primero.

       Sólo cuenta si el dedo NO se arrastró y si cae cerca del toque
       anterior: soltar un arrastre no es un toque, y dos arrastres seguidos
       devolvían el zoom al 100% en plena lectura. */
    const dragged = gestureMoved.current > TAP_SLOP;
    gestureStart.current = null;
    gestureMoved.current = 0;

    if (dragged || pointers.current.size > 0) {
      lastTap.current = null;
      return;
    }

    const now = Date.now();
    const previousTap = lastTap.current;
    const nearby =
      previousTap !== null &&
      Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) <
        DOUBLE_TAP_RADIUS;

    if (previousTap && nearby && now - previousTap.at < DOUBLE_TAP_MS) {
      lastTap.current = null;
      if (scale > 1) reset();
      else zoomAt(() => 2.5, toImageSpace(event));
      return;
    }

    lastTap.current = { at: now, x: event.clientX, y: event.clientY };
  }

  function handleWheel(event: React.WheelEvent) {
    // Sólo con la rueda se acerca; sin esto la página de atrás se desplaza.
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt((current) => current * factor, toImageSpace(event));
  }

  const zoomed = scale > 1;

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <div
        ref={containerRef}
        className="flex size-full items-center justify-center"
        /* `touch-action: none` para que el navegador no se quede con el
           gesto antes de que llegue aquí: sin esto el arrastre desplaza la
           pantalla en vez de mover la foto. */
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            cursor: zoomed ? "grab" : "zoom-in",
            // Sin transición al pellizcar: el dedo va delante y la animación
            // se siente como retraso.
            transition: isGesturing ? "none" : "transform 120ms",
          }}
        />
      </div>

      {/* Sobre la imagen y al alcance del pulgar. Con guantes el pellizco no
          siempre registra los dos dedos. */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 border border-border bg-card p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target"
          aria-label="Alejar"
          disabled={scale <= MIN_SCALE}
          onClick={() => zoomAt((current) => current / STEP, center())}
        >
          <Minus className="size-4" aria-hidden />
        </Button>

        <button
          type="button"
          onClick={reset}
          disabled={!zoomed}
          className="tabular min-w-14 px-1 text-xs text-muted-foreground disabled:opacity-50"
          aria-label="Volver al tamaño original"
        >
          {Math.round(scale * 100)}%
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target"
          aria-label="Acercar"
          disabled={scale >= MAX_SCALE}
          onClick={() => zoomAt((current) => current * STEP, center())}
        >
          <Plus className="size-4" aria-hidden />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target"
          aria-label="Ajustar a la pantalla"
          disabled={!zoomed}
          onClick={reset}
        >
          <Scan className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
