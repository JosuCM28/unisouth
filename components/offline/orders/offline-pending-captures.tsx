"use client";

import { CloudUpload } from "lucide-react";
import { QUEUE_KIND_LABELS } from "@/lib/constants/labels";
import type { QueuedItem } from "@/lib/offline/queue";

/**
 * Lo que este celular capturó de la orden y todavía no sube, con su TMP.
 *
 * Se enseña dentro de la ficha y no sólo en "Datos sin conexión" porque es
 * aquí donde el auxiliar se pregunta "¿ya capturé este corte?". Uno
 * rechazado sale en rojo con el motivo: se corrige o se descarta desde la
 * lista de pendientes.
 */
export function OfflinePendingCaptures({ items }: { items: QueuedItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 border border-border bg-muted p-2">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CloudUpload className="size-3.5" aria-hidden />
        Por subir desde este equipo
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col">
            <span className="flex justify-between gap-3">
              <span>
                {QUEUE_KIND_LABELS[item.kind]}{" "}
                <span className="tabular font-medium">{item.localCode ?? ""}</span>
              </span>
              <span className="truncate text-xs text-muted-foreground">{item.summary}</span>
            </span>
            {item.lastError && (
              <span className="text-xs text-destructive">{item.lastError}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
