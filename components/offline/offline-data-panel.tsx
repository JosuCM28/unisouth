"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Boxes, ClipboardList, Layers, Loader2, PackageMinus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { OfflineTable } from "@/lib/constants/offline-tables";
import { OFFLINE_TABLE_LABELS } from "@/lib/constants/labels";
import { isOfflineDbAvailable, type SyncedRecord } from "@/lib/offline/db";
import type { OfflineTableMeta } from "@/lib/offline/snapshot.types";
import {
  readRecentSynced,
  readSnapshotMeta,
  synchronize,
  type SyncReport,
} from "@/lib/offline/sync-engine";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { Button } from "@/components/ui/button";
import { ChannelSection } from "@/components/notifications/channel-section";
import { ClearSnapshotButton } from "./clear-snapshot-button";
import { OfflineStatusSummary } from "./offline-status-summary";
import { OfflineTableList } from "./offline-table-list";
import { SyncedList } from "./synced-list";

type MetaMap = Map<OfflineTable, OfflineTableMeta>;

/**
 * El tablero de la copia sin conexión de ESTE equipo.
 *
 * Cliente de punta a punta porque todo lo que enseña vive en el navegador
 * (IndexedDB): el servidor no sabe qué tiene guardado cada celular. Del
 * servidor sólo recibe qué tablas le tocan al rol.
 */
export function OfflineDataPanel({ tables }: { tables: OfflineTable[] }) {
  const { items, online, refresh } = useOfflineQueue();
  const { meta, synced, reload } = useLocalState();
  const [downloading, setDownloading] = useState<OfflineTable | null>(null);
  const [busy, setBusy] = useState(false);

  const available = useDbAvailable();

  const rejected = items.filter((item) => item.lastError).length;

  async function handleSync() {
    setBusy(true);
    try {
      const report = await synchronize(tables, setDownloading);
      announce(report);
    } catch (error) {
      console.error("[offline] Falló la sincronización:", error);
      toast.error("No se pudo sincronizar. Intenta de nuevo.");
    } finally {
      setDownloading(null);
      setBusy(false);
      await Promise.all([reload(), refresh()]);
    }
  }

  if (!available) {
    return (
      <p className="flat-surface p-4 text-sm text-muted-foreground">
        Este navegador no permite guardar datos en el equipo (¿modo privado?).
        Ábrelo en una ventana normal para usar la copia sin conexión.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <OfflineStatusSummary
        online={online}
        pending={items.length}
        rejected={rejected}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="touch-target flex-1 sm:flex-none"
          disabled={busy || !online}
          onClick={handleSync}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          {busy ? "Sincronizando…" : "Sincronizar ahora"}
        </Button>

        <Button asChild variant="outline" className="touch-target">
          <Link href="/issues/offline">
            <PackageMinus className="size-4" aria-hidden />
            Salida sin conexión
          </Link>
        </Button>

        {/* Lo que se consulta sin señal. Con red el guardia de navegación no
            interviene y son enlaces normales. */}
        <Button asChild variant="outline" className="touch-target">
          <Link href="/lots/offline">
            <Boxes className="size-4" aria-hidden />
            Inventario
          </Link>
        </Button>
        <Button asChild variant="outline" className="touch-target">
          <Link href="/materials/offline">
            <Layers className="size-4" aria-hidden />
            Materiales
          </Link>
        </Button>
        <Button asChild variant="outline" className="touch-target">
          <Link href="/orders/offline">
            <ClipboardList className="size-4" aria-hidden />
            Órdenes
          </Link>
        </Button>

        <ClearSnapshotButton disabled={busy} onCleared={() => void reload()} />
      </div>

      <ChannelSection
        title="Guardado en este equipo"
        description="Primero se suben las capturas pendientes y luego se baja la copia"
      >
        <OfflineTableList tables={tables} meta={meta} downloading={downloading} />
      </ChannelSection>

      <ChannelSection
        title="Subidas recientes"
        description="El folio provisional que se anotó en el vale y el real que le tocó"
      >
        <SyncedList records={synced} />
      </ChannelSection>
    </div>
  );
}

const noopSubscribe = () => () => {};

/**
 * ¿Hay IndexedDB? Con useSyncExternalStore y no leyéndolo directo en el
 * render: en el servidor no existe, y leerlo directo pintaría el aviso de
 * "no disponible" en el HTML y el panel en el cliente —hidratación rota—.
 * En el servidor se supone que sí hay; el navegador corrige si no.
 */
function useDbAvailable(): boolean {
  return useSyncExternalStore(noopSubscribe, isOfflineDbAvailable, () => true);
}

interface LocalState {
  meta: MetaMap;
  /** Las últimas capturas que subieron, con su folio TMP y el real. */
  synced: SyncedRecord[];
}

const EMPTY_STATE: LocalState = { meta: new Map(), synced: [] };

/** Qué hay guardado y qué ya subió, leído de IndexedDB al montar. */
function useLocalState(): LocalState & { reload: () => Promise<void> } {
  const [state, setState] = useState<LocalState>(EMPTY_STATE);

  const reload = useCallback(async () => {
    setState(await loadLocalState());
  }, []);

  // La lectura inicial resuelve en un callback, no en el cuerpo del efecto:
  // IndexedDB es asíncrono y el estado se fija cuando responde.
  useEffect(() => {
    let cancelled = false;
    void loadLocalState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, reload };
}

async function loadLocalState(): Promise<LocalState> {
  if (!isOfflineDbAvailable()) return EMPTY_STATE;
  const [rows, synced] = await Promise.all([readSnapshotMeta(), readRecentSynced()]);
  return { meta: new Map(rows.map((row) => [row.table, row])), synced };
}

/**
 * El aviso al terminar. Una sola notificación que resume todo, en vez de una
 * por tabla: con once tablas la pantalla se llenaría de avisos.
 */
function announce({ upload, download }: SyncReport): void {
  if (download.stalled) {
    toast.warning(
      "Se cortó la conexión a la mitad. Lo que no se alcanzó a bajar conserva la copia anterior.",
    );
    return;
  }

  if (download.failed.length > 0) {
    const names = download.failed
      .map(({ table }) => OFFLINE_TABLE_LABELS[table])
      .join(", ");
    toast.error(`No se pudo bajar: ${names}`);
    return;
  }

  const uploaded = upload.sent > 0 ? ` Se subieron ${upload.sent} capturas.` : "";
  const bounced =
    upload.rejected > 0 ? ` ${upload.rejected} rechazadas, revísalas.` : "";

  toast.success(`Copia actualizada.${uploaded}${bounced}`);
}
