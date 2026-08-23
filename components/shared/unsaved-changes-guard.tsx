"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Nombre de la marca que distingue nuestra entrada centinela. */
const SENTINEL_KEY = "__unisouthGuard";

interface UnsavedChangesGuardProps {
  /**
   * Hay captura que se perdería al salir. Con `false` el guardia se
   * desmonta por completo y la navegación vuelve a ser normal.
   */
  when: boolean;
  /** Qué se va a perder, en palabras del almacén: "12 rollos capturados". */
  description: string;
  title?: string;
}

/**
 * Avisa antes de abandonar una captura a medias.
 *
 * El caso que resuelve es el de la recepción en celular: veinte rollos
 * tecleados de pie y un roce con el botón "atrás" de Android que se los
 * lleva todos. No hay autoguardado ni borrador; el trato es sólo que nadie
 * pierda la captura sin haber dicho que sí.
 *
 * Cubre las tres salidas reales:
 *
 * 1. **Atrás del teléfono/navegador.** No existe un `onBeforeNavigate` en el
 *    App Router, así que se empuja una entrada centinela al historial
 *    mientras hay captura. Esa entrada apunta a la MISMA url, así que el
 *    "atrás" la consume sin mover la pantalla; nosotros lo oímos en
 *    `popstate` y preguntamos. Si se queda, se vuelve a empujar; si se va,
 *    un segundo "atrás" sale de verdad. El usuario nunca ve la entrada extra.
 * 2. **Enlaces de la app.** La barra inferior y el menú viven FUERA del
 *    formulario, así que el clic se escucha en `document` en fase de captura
 *    y se cancela antes de que Next arranque la navegación.
 * 3. **Cerrar pestaña o recargar.** `beforeunload`, con el diálogo del
 *    navegador —ése no se puede estilizar y no hay forma de evitarlo.
 *
 * Con un diálogo del formulario abierto encima —el alta de material, la de
 * ayudante— el guardia CEDE: ese "atrás" quiere cerrar el diálogo y no salir
 * de la captura. Se cierra el diálogo y el siguiente "atrás" ya pregunta.
 */
export function UnsavedChangesGuard({
  when,
  description,
  title = "¿Salir sin guardar?",
}: UnsavedChangesGuardProps) {
  const router = useRouter();

  /** Destino pendiente de confirmar. `null` = el diálogo está cerrado. */
  const [pending, setPending] = useState<PendingExit | null>(null);

  /* En refs porque los listeners se registran una sola vez: si dependieran
     del estado habría que reinstalarlos en cada tecla capturada. */
  const whenRef = useRef(when);
  whenRef.current = when;

  /** Se levanta al confirmar la salida, para no volver a preguntar. */
  const leavingRef = useRef(false);

  /* --- 1. Atrás del teléfono ------------------------------------------ */

  useEffect(() => {
    if (!when) return;

    pushSentinel();

    function handlePopState() {
      if (leavingRef.current || !whenRef.current) return;

      /* Con un diálogo abierto —"registrar material nuevo", por ejemplo— el
         "atrás" del teléfono quiere cerrar ESE diálogo, no salirse de la
         captura. Preguntar aquí sería contestar a otra cosa, así que el
         guardia se hace a un lado: cierra el diálogo, repone el centinela y
         el siguiente "atrás" ya sí pregunta por la captura. */
      if (hasOpenModal()) {
        closeTopModal();
        pushSentinel();
        return;
      }

      /* El "atrás" ya consumió el centinela y el navegador nos dejó en la
         entrada anterior —misma pantalla, porque el centinela no cambió de
         URL—. NO se repone aquí: se repone sólo si el usuario decide
         quedarse. Reponerlo antes de preguntar dejaría una entrada de más
         que el "salir" tendría que consumir, y salir no funcionaría. */
      setPending({ kind: "back" });
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);

      /* Al desarmarse el guardia —se guardó, o la captura quedó vacía— el
         centinela se desmarca en sitio. Sacarlo con `back()` competiría con
         el `router.push` que suele venir justo después de guardar. Queda una
         entrada de la misma URL en el historial: un "atrás" de más que no
         mueve de pantalla, que es mucho menos malo que una navegación
         cancelada a medias. */
      if (!leavingRef.current && isSentinel(window.history.state)) {
        window.history.replaceState(stripSentinel(window.history.state), "");
      }
    };
  }, [when]);

  /* --- 2. Enlaces de la app ------------------------------------------- */

  useEffect(() => {
    if (!when) return;

    function handleClick(event: MouseEvent) {
      if (leavingRef.current || !whenRef.current) return;

      // Clic con modificador o con otro botón: abre en pestaña nueva y no
      // abandona la captura.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      /* Un href que no se puede resolver —`mailto:`, `tel:`, un esquema
         raro— no es una navegación dentro de la app y no se toca. Este
         manejador corre en CADA clic de la pantalla: si tira, se lleva por
         delante la interacción del usuario. */
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      // Un ancla a la misma página (#seccion) no sale de la captura.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPending({ kind: "link", href: url.pathname + url.search });
    }

    // En captura: hay que ganarle al manejador de <Link> de Next.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [when]);

  /* --- 3. Cerrar pestaña o recargar ------------------------------------ */

  useEffect(() => {
    if (!when) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (leavingRef.current) return;
      event.preventDefault();
      // Los navegadores modernos ignoran el texto y ponen el suyo, pero
      // algunos todavía exigen que returnValue quede asignado.
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [when]);

  const confirm = useCallback(() => {
    const exit = pending;
    setPending(null);
    if (!exit) return;

    leavingRef.current = true;

    if (exit.kind === "link") {
      /* El centinela se desmarca EN SITIO, no con un `back()`.
         El centinela no cambió de URL, así que basta con quitarle la marca
         para que deje de contar como entrada del guardia. Sacarlo con
         `back()` era una navegación asíncrona que le ganaba la carrera al
         `push` de abajo y la pantalla se quedaba donde estaba. */
      if (isSentinel(window.history.state)) {
        window.history.replaceState(stripSentinel(window.history.state), "");
      }
      router.push(exit.href);
      return;
    }

    // El "atrás" que disparó el aviso ya consumió el centinela, así que
    // este segundo sale de verdad a la pantalla anterior.
    window.history.back();
  }, [pending, router]);

  /**
   * Se queda en la captura.
   *
   * Si el aviso vino del botón "atrás", el centinela ya se consumió y hay
   * que reponerlo: sin él, el siguiente "atrás" se saldría sin preguntar.
   */
  const cancel = useCallback(() => {
    if (pending?.kind === "back" && !isSentinel(window.history.state)) {
      pushSentinel();
    }
    setPending(null);
  }, [pending]);

  if (!when) return null;

  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      {/* La marca distingue este aviso de un diálogo del formulario: sin
          ella, el propio aviso contaría como "modal abierto" y el guardia
          intentaría cerrarlo en vez de preguntar. */}
      <AlertDialogContent data-unisouth-guard>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description} No se guarda nada y no hay forma de recuperarlo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel className="touch-target">
            Seguir capturando
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            className="touch-target bg-destructive text-white hover:bg-destructive/90"
          >
            Salir y perder
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Salida que el usuario intentó y está pendiente de confirmar. */
type PendingExit = { kind: "back" } | { kind: "link"; href: string };

/**
 * ¿Hay un diálogo u hoja abierto encima de la captura?
 *
 * Se pregunta al DOM y no a un estado propio porque los diálogos los abren
 * los componentes hijos —el alta de material, la de ayudante— y el guardia
 * no tiene forma de enterarse. Radix marca su contenido con `data-state` y
 * el rol correspondiente, que es lo que se busca aquí. Se excluye el
 * `alertdialog` propio: cuando el aviso ya está en pantalla no cuenta como
 * un modal ajeno que haya que cerrar.
 */
function hasOpenModal(): boolean {
  return document.querySelector(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]:not([data-unisouth-guard])',
  ) !== null;
}

/**
 * Cierra el diálogo de encima como lo haría el usuario: con Escape.
 *
 * Mandar la tecla en vez de tocar el estado del hijo deja que Radix haga su
 * cierre normal —devolver el foco al disparador, soltar el bloqueo del
 * scroll— en vez de dejar la pantalla a medio cerrar.
 */
function closeTopModal(): void {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
}

/**
 * Empuja la entrada centinela conservando el estado de Next.
 *
 * Next guarda su árbol de rutas en `history.state`. Empujar un objeto
 * nuestro a secas lo dejaría fuera de esa entrada y su navegación se
 * confundiría, así que la marca se AGREGA a lo que ya había.
 */
function pushSentinel(): void {
  const current =
    window.history.state && typeof window.history.state === "object"
      ? (window.history.state as Record<string, unknown>)
      : {};

  window.history.pushState({ ...current, [SENTINEL_KEY]: true }, "");
}

function isSentinel(state: unknown): boolean {
  return Boolean(state && typeof state === "object" && SENTINEL_KEY in state);
}

/**
 * Quita nuestra marca dejando intacto lo demás.
 *
 * Next guarda su propio árbol de rutas en `history.state`; reemplazarlo por
 * un objeto limpio rompería su navegación. Sólo se borra la marca.
 */
function stripSentinel(state: unknown): unknown {
  if (!state || typeof state !== "object") return state;

  const { [SENTINEL_KEY]: _marca, ...resto } = state as Record<string, unknown>;
  return resto;
}

/**
 * Cuenta en palabras lo que se perdería.
 *
 * "Perderás 12 rollos capturados" mueve más que "hay cambios sin guardar":
 * el auxiliar sabe exactamente cuánto trabajo está en juego.
 */
export function describeLoss(count: number, singular: string, plural: string): string {
  if (count === 1) return `Perderás ${count} ${singular} que capturaste.`;
  return `Perderás los ${count} ${plural} que capturaste.`;
}
