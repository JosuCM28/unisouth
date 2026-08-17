"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** El QR del rollo contiene {APP_URL}/r/{code}; también se acepta el folio solo. */
function extractCode(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const match = text.match(/\/r\/([^/?#]+)/i);
  if (match?.[1]) return decodeURIComponent(match[1]);

  // Un folio tecleado a mano: R-2026-00841
  if (/^[A-Za-z0-9-]+$/.test(text)) return text.toUpperCase();

  return null;
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

  function goToLot(code: string) {
    stopRef.current?.();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    router.push(`/lots/${encodeURIComponent(code)}`);
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
        const code = raw ? extractCode(raw) : null;

        if (code) {
          goToLot(code);
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
        const code = extractCode(decoded);
        if (code) goToLot(code);
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
    const code = extractCode(manualCode);

    if (!code) {
      toast.error("Escribe un folio válido, como R-2026-00841.");
      return;
    }

    goToLot(code);
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
                Apunta al código QR pegado en el rollo.
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
