"use client";

import { useState } from "react";
import { CloudOff, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { QUEUE_KINDS } from "@/lib/offline/kinds";
import { removeItem } from "@/lib/offline/queue";
import { formatDateTime } from "@/lib/utils";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Aviso de capturas pendientes de enviar.
 *
 * Sólo se pinta si hay algo pendiente o si se cayó la red: cuando todo está
 * al día no ocupa espacio. Va sobre la barra inferior porque es donde está
 * el pulgar y porque una captura sin enviar es lo más urgente que puede
 * haber en pantalla.
 */
export function OfflineIndicator() {
  const { pending, items, online, syncing, sync, refresh } = useOfflineQueue();
  const [open, setOpen] = useState(false);

  if (pending === 0 && online) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Se para justo encima de la barra inferior en celular; en escritorio
        // no hay barra, así que baja hasta la esquina.
        className="touch-target safe-bottom fixed inset-x-0 bottom-16 z-40 flex items-center justify-center gap-2 border-t border-state-reserved bg-state-reserved-muted px-4 py-2 text-sm font-medium text-state-reserved-foreground md:inset-x-auto md:right-6 md:bottom-6 md:rounded-[4px] md:border"
      >
        {syncing ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <CloudOff className="size-4 shrink-0" aria-hidden />
        )}
        <span>{statusLabel({ pending, online, syncing })}</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="safe-bottom max-h-[85dvh] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Capturas pendientes</SheetTitle>
            <SheetDescription>
              Se enviaron sin conexión. Se mandan solas al volver el internet.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3 px-4 pb-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="flat-surface flex items-start justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {QUEUE_KINDS[item.kind].label}
                  </p>
                  <p className="truncate text-sm">{item.summary}</p>
                  <p className="tabular mt-1 text-xs text-muted-foreground">
                    {formatDateTime(new Date(item.createdAt))}
                  </p>

                  {/* El motivo del rechazo es lo que permite corregir en vez
                      de reintentar a ciegas para siempre. */}
                  {item.lastError && (
                    <p className="mt-1 text-xs text-destructive">
                      {item.lastError}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="touch-target shrink-0"
                  aria-label="Descartar captura"
                  onClick={async () => {
                    await removeItem(item.id);
                    await refresh();
                    toast.success("Captura descartada");
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </article>
            ))}

            {items.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay nada pendiente.
              </p>
            )}

            <Button
              type="button"
              className="touch-target w-full"
              disabled={syncing || items.length === 0}
              onClick={async () => {
                const before = items.length;
                await sync();
                toast.success(`Se intentaron enviar ${before} capturas`);
              }}
            >
              {syncing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              {syncing ? "Enviando…" : "Reintentar ahora"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * El texto de la franja.
 *
 * Es una función con returns tempranos y no ternarias anidadas: son cuatro
 * casos y encadenarlos sería justo lo que prohíbe el CLAUDE.md.
 */
function statusLabel(state: {
  pending: number;
  online: boolean;
  syncing: boolean;
}): string {
  if (state.syncing) return "Enviando capturas…";

  if (state.pending === 0) return "Sin conexión";

  const noun = state.pending === 1 ? "captura" : "capturas";
  if (!state.online) return `Sin conexión · ${state.pending} ${noun} guardadas`;

  return `${state.pending} ${noun} por enviar`;
}
