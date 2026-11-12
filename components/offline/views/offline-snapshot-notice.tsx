import { CloudOff, Database } from "lucide-react";
import type { OfflineTableMeta } from "@/lib/offline/snapshot.types";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

/**
 * "Copia de las…" arriba de cada vista sin conexión.
 *
 * Va siempre visible porque el saldo que se enseña es el del momento de la
 * descarga: mientras no hay señal otra persona pudo haber cortado ese rollo,
 * y quien consulta tiene que saber qué tan viejo es el dato.
 */
export function OfflineSnapshotNotice({ meta }: { meta: OfflineTableMeta }) {
  return (
    <p className="flat-surface flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
      <CloudOff className="size-4 shrink-0" aria-hidden />
      <span>
        Copia de las{" "}
        <span className="tabular">{formatDateTime(meta.downloadedAt)}</span>. Los
        saldos pueden haber cambiado desde entonces.
      </span>
    </p>
  );
}

/** La tabla nunca se descargó en este equipo: se manda a donde se baja. */
export function OfflineSnapshotMissing() {
  return (
    <div className="flat-surface flex flex-col items-center gap-3 pb-6">
      <EmptyState
        icon={Database}
        title="No hay copia en este equipo"
        description="Con internet, entra a Datos sin conexión y pulsa Sincronizar ahora."
      />
      {/* `<a>` y no `<Link>`: sin red, la navegación del router falla y la
          carga completa sí la contesta el service worker. */}
      <Button asChild variant="outline" className="touch-target">
        <a href="/offline-data">Ir a Datos sin conexión</a>
      </Button>
    </div>
  );
}

/** Mientras se lee IndexedDB: un instante, sin parpadear "sin copia". */
export function OfflineLoading() {
  return (
    <p className="flat-surface px-3 py-6 text-center text-sm text-muted-foreground">
      Leyendo la copia…
    </p>
  );
}

