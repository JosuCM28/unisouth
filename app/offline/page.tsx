import { CloudOff } from "lucide-react";

export const metadata = { title: "Sin conexión" };

/**
 * Pantalla de respaldo del service worker.
 *
 * Se muestra al abrir sin internet una pantalla que nunca se había visitado.
 * Es estática a propósito: no consulta nada, porque justamente no hay red.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <CloudOff className="size-12 text-muted-foreground" aria-hidden />

      <h1 className="text-lg font-medium">Sin conexión</h1>

      <p className="max-w-sm text-sm text-muted-foreground">
        Esta pantalla no se ha abierto antes en este equipo, así que no hay copia
        guardada. Lo que hayas capturado sin internet sigue a salvo y se enviará
        solo en cuanto vuelva la señal.
      </p>
    </main>
  );
}
