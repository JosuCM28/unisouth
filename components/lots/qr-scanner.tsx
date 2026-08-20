"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Qué se leyó: un rollo suelto o la hoja de una pila completa. */
type ScanTarget = { kind: "lot" | "material"; code: string };

/**
 * Traduce lo que devolvió la cámara a un destino de la app.
 *
 * Se aceptan los DOS códigos que se imprimen en bodega, porque el auxiliar
 * apunta el mismo escáner a los dos sin fijarse cuál es: la etiqueta del
 * rollo ({APP_URL}/r/{folio}) y la hoja de la pila ({APP_URL}/m/{clave}).
 * Antes sólo se reconocía el del rollo, así que escanear una pila no hacía
 * absolutamente nada: el lector seguía buscando y parecía descompuesto.
 */
function extractTarget(raw: string): ScanTarget | null {
  const text = raw.trim();
  if (!text) return null;

  // El código del material puede traer "/" (TELA/AZUL), así que se toma todo
  // lo que sigue a /m/ hasta el query, no sólo el primer segmento.
  const material = text.match(/\/m\/([^?#]+)/i);
  if (material?.[1]) {
    const code = safeDecode(material[1]);
    return code ? { kind: "material", code } : null;
  }

  const lot = text.match(/\/r\/([^/?#]+)/i);
  if (lot?.[1]) {
    const code = safeDecode(lot[1]);
    return code ? { kind: "lot", code } : null;
  }

  // Tecleado a mano. Se asume rollo: es lo que se teclea en el piso, y si la
  // clave resulta ser de un material la propia ficha del rollo dirá que no
  // existe ese folio.
  if (/^[A-Za-z0-9-]+$/.test(text)) {
    return { kind: "lot", code: text.toUpperCase() };
  }

  return null;
}

function safeDecode(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value).trim().replace(/\/+$/, "");
    return decoded.length > 0 ? decoded : null;
  } catch {
    // Un porcentaje mal formado revienta decodeURIComponent.
    return null;
  }
}

type ScannerState = "idle" | "starting" | "scanning" | "unsupported" | "denied";

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const [state, setState] = useState<ScannerState>("idle");
  const [manualCode, setManualCode] = useState("");

  // Se apaga la cámara al salir: dejarla encendida gasta batería y en el
  // piso el teléfono ya anda justo de carga.
  useEffect(() => {
    return () => {
      stopRef.current?.();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  /**
   * Apaga la cámara y navega al destino que se leyó.
   *
   * El rollo abre su ficha; la pila abre la ficha del MATERIAL, que es lo que
   * se quiere ver parado frente a la estiba: qué tela es, cuánta queda y de
   * qué tonos. Cada segmento se codifica por separado para que una clave con
   * "/" adentro (TELA/AZUL) no se lea como dos tramos de la ruta.
   */
  function goTo(target: ScanTarget) {
    stopRef.current?.();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    const segment = encodeURIComponent(target.code);
    const base = target.kind === "material" ? "/materials" : "/lots";
    router.push(`${base}/${segment}`);
  }

  async function startScanning() {
    setState("starting");

    try {
      // Chrome/Android trae detector nativo: más rápido y sin descargar nada.
      if ("BarcodeDetector" in globalThis) {
        await startNative();
        return;
      }
      // Safari iOS no lo tiene; ahí se carga la librería bajo demanda.
      await startFallback();
    } catch (error) {
      handleStartError(error);
    }
  }

  async function startNative() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;
    await video.play();
    setState("scanning");

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any --
       BarcodeDetector aún no está en los tipos de TypeScript. */
    const Detector = (globalThis as any).BarcodeDetector;
    const detector = new Detector({ formats: ["qr_code"] });

    let active = true;
    stopRef.current = () => {
      active = false;
    };

    const tick = async () => {
      if (!active || !videoRef.current) return;

      try {
        const codes = await detector.detect(videoRef.current);
        const raw = codes[0]?.rawValue;
        const target = raw ? extractTarget(raw) : null;

        if (target) {
          goTo(target);
          return;
        }
      } catch {
        // Un cuadro ilegible no es un error: se sigue intentando.
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  async function startFallback() {
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-fallback-region");

    stopRef.current = () => {
      scanner.stop().catch(() => undefined);
    };

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decoded) => {
        const target = extractTarget(decoded);
        if (target) goTo(target);
      },
      () => undefined,
    );

    setState("scanning");
  }

  function handleStartError(error: unknown) {
    const name = error instanceof Error ? error.name : "";

    if (name === "NotAllowedError" || name === "SecurityError") {
      setState("denied");
      toast.error("No diste permiso para usar la cámara.");
      return;
    }

    setState("unsupported");
    toast.error("No se pudo abrir la cámara. Escribe el folio a mano.");
  }

  function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault();
    const target = extractTarget(manualCode);

    if (!target) {
      toast.error("Escribe un folio válido, como R-2026-00841.");
      return;
    }

    goTo(target);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flat-surface overflow-hidden">
        <div className="relative aspect-square w-full bg-secondary">
          <video
            ref={videoRef}
            playsInline
            muted
            className="size-full object-cover"
          />
          <div id="qr-fallback-region" className="absolute inset-0" />

          {state !== "scanning" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Camera className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Apunta al código QR del rollo o de la hoja de la pila.
              </p>
              <Button
                type="button"
                onClick={startScanning}
                disabled={state === "starting"}
                className="touch-target"
              >
                {state === "starting" ? "Abriendo cámara…" : "Encender cámara"}
              </Button>
            </div>
          )}

          {/* Marco guía: ayuda a encuadrar sin acercar demasiado el teléfono. */}
          {state === "scanning" && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <div className="size-56 border-2 border-primary" />
            </div>
          )}
        </div>
      </section>

      {(state === "denied" || state === "unsupported") && (
        <div className="flex items-start gap-2 border border-border p-3">
          <CameraOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">
            {state === "denied"
              ? "Permite el acceso a la cámara en los ajustes del navegador, o escribe el folio abajo."
              : "Este teléfono no puede escanear desde el navegador. Escribe el folio abajo."}
          </p>
        </div>
      )}

      {/* El respaldo de siempre: la etiqueta se despega, se ensucia o el
          lector no enfoca, y el folio se puede teclear. */}
      <form onSubmit={handleManualSubmit} className="flat-surface flex flex-col gap-3 p-4">
        <Label htmlFor="manual-code">O escribe el folio</Label>
        <div className="flex gap-2">
          <Input
            id="manual-code"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder="R-2026-00841"
            inputMode="search"
            autoCapitalize="characters"
            autoComplete="off"
            className="touch-target tabular uppercase"
          />
          <Button type="submit" className="touch-target shrink-0">
            <Search className="size-4" aria-hidden />
            Buscar
          </Button>
        </div>
      </form>
    </div>
  );
}
