"use client";

import { useMemo, useState } from "react";
import { Copy, Percent, Send } from "lucide-react";
import { toast } from "sonner";
import {
  splitBundles,
  type SplitBundle,
  type SplitGroup,
  type SplitResult,
} from "@/lib/workshop-split";
import { FolderSplitShipmentDialog } from "./folder-split-shipment-dialog";
import {
  OrderShipmentDialog,
  type ShippableSize,
} from "./order-shipment-dialog";
import type { CutTagChoice } from "./size-bundle-rows";
import type { SplitCut } from "@/lib/folder-split-cuts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type { SplitCut };

/**
 * A dónde se manda cada lado del reparto. Cada pantalla trae su propio camino:
 * una orden suelta manda con su diálogo de envío (un solo papel), y un pedido
 * crea un envío por cada orden que aporta bultos.
 */
export type SplitShipping =
  | {
      kind: "order";
      orderId: string;
      orderCode: string;
      sizes: ShippableSize[];
      tags: CutTagChoice[];
      workshops: { id: string; name: string }[];
      stages: { id: string; name: string }[];
    }
  | {
      kind: "folder";
      folderId: string;
      folderCode: string;
      workshops: { id: string; name: string }[];
      stages: { id: string; name: string }[];
    };

/** Hasta cuántas piezas se tolera que el reparto se aparte del porcentaje. */
const TOLERANCE_PIECES = 40;

const DEFAULT_PERCENT = 40;

/**
 * REPARTO A DOS TALLERES: qué bultos van a uno y cuáles al otro.
 *
 * Se calcula en el navegador con los bultos ya capturados y no se guarda: es
 * una ayuda para armar las dos salidas, y un reparto guardado empezaría a
 * mentir en cuanto alguien corrigiera un bulto del corte.
 *
 * Los cortes se marcan uno por uno porque la salida a taller se hace por
 * tendido: lo que se reparte es lo que se va a cargar ahora, no el historial.
 */
export function WorkshopSplitPanel({
  cuts,
  shipping,
}: {
  cuts: SplitCut[];
  /** Sin esto el panel sólo calcula; no ofrece mandar nada. */
  shipping?: SplitShipping;
}) {
  const [percent, setPercent] = useState(DEFAULT_PERCENT);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(cuts.map((cut) => cut.id)),
  );

  const result = useMemo(() => {
    const bundles = cuts
      .filter((cut) => selected.has(cut.id))
      .flatMap((cut) => cut.bundles);
    return splitBundles(bundles, percent);
  }, [cuts, selected, percent]);

  if (cuts.length === 0) return null;

  const rest = 100 - percent;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePercent(raw: string) {
    const value = Number(raw);
    if (Number.isNaN(value)) return;
    setPercent(Math.min(Math.max(Math.round(value), 0), 100));
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildMessage(result, percent));
      toast.success("Reparto copiado.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  return (
    <details className="flat-surface p-3">
      <summary className="touch-target flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
        <Percent className="size-4" aria-hidden />
        Reparto a talleres {percent}% / {rest}%
      </summary>

      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="split-percent" className="text-xs">
              Primer taller (%)
            </Label>
            <Input
              id="split-percent"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={percent}
              onChange={(event) => handlePercent(event.target.value)}
              className="tabular h-11 w-24"
            />
          </div>
          <p className="tabular pb-3 text-sm text-muted-foreground">
            El segundo recibe {rest}%
          </p>
        </div>

        {/* Con un solo corte no hay nada que elegir: la lista sólo estorbaría. */}
        {cuts.length > 1 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs text-muted-foreground">
              Cortes incluidos
            </legend>
            {cuts.map((cut) => (
              <label
                key={cut.id}
                className="touch-target flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.has(cut.id)}
                  onChange={() => toggle(cut.id)}
                  className="size-4"
                />
                <span>{cut.label}</span>
              </label>
            ))}
          </fieldset>
        )}

        {/* Un corte global de antes no guardó sus bultos reales: lo que hay
            son los pedazos que le tocaron a cada orden. Se dice cómo
            arreglarlo en vez de repartir callado sobre bultos que no existen. */}
        {cuts.some((cut) => cut.partial && selected.has(cut.id)) && (
          <p className="border border-border bg-muted p-2 text-xs">
            <span className="font-medium">Ojo:</span>{" "}
            {cuts
              .filter((cut) => cut.partial && selected.has(cut.id))
              .map((cut) => cut.label)
              .join(", ")}{" "}
            se capturó antes de guardar los bultos reales y algunos pueden
            verse partidos (un “bulto de 4” que en la mesa era parte de uno de
            28). Ábrelo en <span className="font-medium">Corte global</span>,
            deja los bultos como se amarraron y guarda.
          </p>
        )}

        {result.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin piezas capturadas en los cortes elegidos.
          </p>
        ) : (
          <SplitSummary
            result={result}
            percent={percent}
            onCopy={handleCopy}
            shipping={shipping}
          />
        )}
      </div>
    </details>
  );
}

function SplitSummary({
  result,
  percent,
  onCopy,
  shipping,
}: {
  result: SplitResult;
  percent: number;
  onCopy: () => void;
  shipping?: SplitShipping;
}) {
  const firstBundles = result.sizes.flatMap((size) => size.firstBundles);
  const secondBundles = result.sizes.flatMap((size) => size.secondBundles);
  const withinTolerance = Math.abs(result.deviation) <= TOLERANCE_PIECES;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Side
          title={`${percent}%`}
          pieces={result.firstPieces}
          target={result.firstTarget}
          action={
            <SendSide
              shipping={shipping}
              sideLabel={`${percent}%`}
              bundles={firstBundles}
            />
          }
        />
        <Side
          title={`${100 - percent}%`}
          pieces={result.secondPieces}
          target={result.total - result.firstTarget}
          action={
            <SendSide
              shipping={shipping}
              sideLabel={`${100 - percent}%`}
              bundles={secondBundles}
            />
          }
        />
      </div>

      <p
        className={
          withinTolerance
            ? "text-xs text-muted-foreground"
            : "text-xs font-medium text-state-reserved"
        }
      >
        Total {result.total} pzas. Diferencia contra el porcentaje exacto:{" "}
        <span className="tabular">
          {result.deviation > 0 ? "+" : ""}
          {result.deviation}
        </span>{" "}
        pzas
        {!withinTolerance &&
          ` (pasa de ${TOLERANCE_PIECES}: los bultos son muy grandes para acercarse más)`}
        .
      </p>

      <ul className="flex flex-col">
        {result.sizes.map((size) => (
          <li
            key={size.sizeCode}
            className="grid grid-cols-[3.5rem_1fr_1fr] gap-2 border-t border-border py-1.5 text-sm"
          >
            <span className="tabular font-medium">{size.sizeCode}</span>
            <SizeCell groups={size.first} pieces={size.firstPieces} />
            <SizeCell groups={size.second} pieces={size.secondPieces} />
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        onClick={onCopy}
        className="touch-target w-full sm:w-auto sm:self-end"
      >
        <Copy className="size-4" aria-hidden />
        Copiar reparto
      </Button>
    </div>
  );
}

function Side({
  title,
  pieces,
  target,
  action,
}: {
  title: string;
  pieces: number;
  target: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded border border-border bg-muted p-2">
      <p className="text-xs text-muted-foreground">Taller {title}</p>
      <p className="tabular text-xl font-semibold leading-tight">{pieces}</p>
      <p className="tabular text-xs text-muted-foreground">
        exacto: {target}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** El botón de mandar UN lado del reparto, según la pantalla en que se está. */
function SendSide({
  shipping,
  sideLabel,
  bundles,
}: {
  shipping?: SplitShipping;
  sideLabel: string;
  bundles: SplitBundle[];
}) {
  if (!shipping || bundles.length === 0) return null;

  if (shipping.kind === "folder") {
    return (
      <FolderSplitShipmentDialog
        folderId={shipping.folderId}
        folderCode={shipping.folderCode}
        sideLabel={sideLabel}
        bundles={bundles}
        workshops={shipping.workshops}
        stages={shipping.stages}
      />
    );
  }

  // Sólo bultos con talla conocida: sin ella el renglón no se puede cargar.
  const rows = bundles.flatMap((bundle) =>
    bundle.sizeId
      ? [
          {
            sizeId: bundle.sizeId,
            quantity: bundle.pieces,
            bundles: bundle.count,
            tagId: bundle.tagId ?? null,
            note: bundle.note ?? null,
          },
        ]
      : [],
  );

  return (
    <OrderShipmentDialog
      orderId={shipping.orderId}
      orderCode={shipping.orderCode}
      sizes={shipping.sizes}
      tags={shipping.tags}
      workshops={shipping.workshops}
      stages={shipping.stages}
      batch={{
        label: `reparto ${sideLabel}`,
        rows,
        netPieces: rows.reduce((sum, row) => sum + row.quantity * row.bundles, 0),
      }}
      trigger={
        <Button variant="outline" className="touch-target w-full">
          <Send className="size-4" aria-hidden />
          Mandar {sideLabel}
        </Button>
      }
    />
  );
}

function SizeCell({
  groups,
  pieces,
}: {
  groups: SplitGroup[];
  pieces: number;
}) {
  if (groups.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="tabular flex flex-col">
      <span className="font-medium">{pieces}</span>
      <span className="text-xs text-muted-foreground">
        {describeGroups(groups)}
      </span>
    </span>
  );
}

/** "2 × 60 + 1 × 50": los bultos, tal como se cuentan en la mesa. */
function describeGroups(groups: SplitGroup[]): string {
  return groups.map((group) => `${group.count}×${group.pieces}`).join(" + ");
}

/** El reparto como texto, para pegarlo en un mensaje o en el vale. */
function buildMessage(result: SplitResult, percent: number): string {
  const lines = [
    `Reparto ${percent}% / ${100 - percent}% — total ${result.total} pzas`,
    `${percent}%: ${result.firstPieces} pzas · ${100 - percent}%: ${result.secondPieces} pzas`,
  ];

  for (const size of result.sizes) {
    lines.push(
      `Talla ${size.sizeCode}: ${percent}% → ${size.firstPieces} (${describeGroups(size.first) || "—"}) · ${100 - percent}% → ${size.secondPieces} (${describeGroups(size.second) || "—"})`,
    );
  }

  return lines.join("\n");
}
