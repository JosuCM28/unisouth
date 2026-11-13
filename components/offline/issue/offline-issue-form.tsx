"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, PackageMinus } from "lucide-react";
import { toast } from "sonner";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { pendingIssuedByLot } from "@/lib/offline/local-stock";
import { captureOfflineIssue } from "@/lib/offline/offline-issue";
import { formatQuantity } from "@/lib/utils";
import { useOfflineCatalog, useOfflineLotsOf } from "@/hooks/use-offline-catalog";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OfflineIssueDetails } from "./offline-issue-details";
import {
  lineProblem,
  OfflineIssueLines,
  parseQuantity,
  type DraftLine,
} from "./offline-issue-lines";
import { OfflineIssueResult, type IssueResult } from "./offline-issue-result";
import { OfflineLotSearch } from "./offline-lot-search";
import { useIssueDraft } from "./use-issue-draft";

/**
 * Salida de rollos que funciona con o sin señal.
 *
 * Todo lo que enseña sale de la copia local (IndexedDB), así que abre igual
 * en el andén sin WiFi. Al guardar, si hay señal se aplica en el momento; si
 * no, se encola con folio TMP y se aplica sola al volver el internet.
 */
export function OfflineIssueForm({
  order,
  onClose,
}: {
  /**
   * La orden de la que sale la tela, cuando se abre desde su ficha. Arranca
   * con su cliente dueño y la salida queda ligada a la orden al subir, igual
   * que una salida en línea capturada desde la orden.
   */
  order?: { id: string; clientId: string | null };
  /** Desde la ficha, "Capturar otra" cierra el diálogo en vez de limpiar. */
  onClose?: () => void;
} = {}) {
  const catalog = useOfflineCatalog();
  const { items } = useOfflineQueue();
  const draft = useIssueDraft(order?.clientId ?? "");
  const lots = useOfflineLotsOf(draft.clientId);
  const pendingByLot = useMemo(() => pendingIssuedByLot(items), [items]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);

  const selectedIds = useMemo(
    () => new Set(draft.lines.map((line) => line.lot.id)),
    [draft.lines],
  );

  if (catalog.loaded && catalog.clients.length === 0) return <NoSnapshot />;

  if (result) {
    return (
      <OfflineIssueResult
        result={result}
        onNew={onClose ?? (() => setResult(null))}
        newLabel={onClose ? "Listo" : undefined}
      />
    );
  }

  async function handleSave() {
    const blocker = saveBlocker(draft.clientId, draft.lines);
    if (blocker) {
      toast.error(blocker);
      return;
    }

    setSaving(true);
    try {
      const captured = await captureOfflineIssue(
        {
          clientId: draft.clientId,
          cuttingOrderId: order?.id,
          ...draft.details,
          lines: toPayloadLines(draft.lines),
        },
        summarize(draft.lines, catalog.clients, draft.clientId),
      );
      const next = toResult(captured.outcome, captured.localCode);
      if (next) {
        draft.reset();
        setResult(next);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="offline-issue-client">Cliente dueño</Label>
        <Select value={draft.clientId} onValueChange={draft.setClientId}>
          <SelectTrigger id="offline-issue-client" className="touch-target w-full">
            <SelectValue placeholder="Elige el cliente" />
          </SelectTrigger>
          <SelectContent>
            {catalog.clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {draft.clientId && (
        <>
          <OfflineIssueLines
            lines={draft.lines}
            materials={catalog.materials}
            onChange={draft.changeQuantity}
            onRemove={draft.removeLot}
          />

          <OfflineLotSearch
            lots={lots}
            materials={catalog.materials}
            locations={catalog.locations}
            pendingByLot={pendingByLot}
            selectedIds={selectedIds}
            onAdd={(lot) => draft.addLot(lot, pendingByLot)}
          />

          <OfflineIssueDetails value={draft.details} onChange={draft.setDetails} />

          <Button
            type="button"
            className="touch-target w-full"
            disabled={saving || draft.lines.length === 0}
            onClick={handleSave}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <PackageMinus className="size-4" aria-hidden />
            )}
            {saving ? "Guardando…" : "Guardar salida"}
          </Button>
        </>
      )}
    </div>
  );
}

/** Lo que impide guardar, o `null`. Se revisa antes de tocar la cola. */
function saveBlocker(clientId: string, lines: DraftLine[]): string | null {
  if (!clientId) return "Elige el cliente dueño de la tela.";
  if (lines.length === 0) return "Agrega al menos un rollo.";

  const wrong = lines.find((line) => lineProblem(line));
  if (wrong) return `${wrong.lot.code}: ${lineProblem(wrong)}`;

  return null;
}

function toPayloadLines(lines: DraftLine[]) {
  return lines.map((line) => ({
    lotId: line.lot.id,
    quantity: parseQuantity(line.quantity),
    unit: line.lot.unit,
  }));
}

/** El renglón de la lista de pendientes: "Ternium · 2 rollos · 85 m". */
function summarize(
  lines: DraftLine[],
  clients: { id: string; name: string }[],
  clientId: string,
): string {
  const client = clients.find((entry) => entry.id === clientId)?.name ?? "Cliente";
  const total = lines.reduce((sum, line) => sum + parseQuantity(line.quantity), 0);
  const first = lines[0];
  const unit = first ? UNIT_SHORT_LABELS[first.lot.unit] : undefined;
  const rolls = lines.length === 1 ? "1 rollo" : `${lines.length} rollos`;

  return `${client} · ${rolls} · ${formatQuantity(total, { unit })}`;
}

/**
 * Traduce el desenlace a lo que se pinta. Un rechazo del servidor (había
 * señal y algún rollo ya no alcanzaba) se avisa y el borrador se queda en
 * pantalla para corregirlo: no hay nada que guardar todavía.
 */
function toResult(
  outcome: Awaited<ReturnType<typeof captureOfflineIssue>>["outcome"],
  localCode: string,
): IssueResult | null {
  if (outcome.status === "sent") return { status: "sent", code: outcome.data.code };
  if (outcome.status === "queued") return { status: "queued", localCode };

  toast.error(outcome.error);
  return null;
}

function NoSnapshot() {
  return (
    <div className="flat-surface flex flex-col items-start gap-3 p-4 text-sm">
      <p>
        Este equipo no tiene copia de la base. Bájala con señal desde Datos sin
        conexión para poder capturar salidas sin internet.
      </p>
      <Button asChild variant="outline" className="touch-target">
        <Link href="/offline-data">Ir a Datos sin conexión</Link>
      </Button>
    </div>
  );
}
