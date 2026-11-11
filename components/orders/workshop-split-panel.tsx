"use client";

import { useMemo, useState } from "react";
import { Copy, Percent, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import {
  SPLIT_TOLERANCE_PIECES as TOLERANCE_PIECES,
  splitBundles,
  type SplitBundle,
  type SplitGroup,
  type SplitResult,
  type SplitSide,
} from "@/lib/workshop-split";
import { FolderSplitShipmentDialog } from "./folder-split-shipment-dialog";
import {
  OrderShipmentDialog,
  type ShippableSize,
} from "./order-shipment-dialog";
import type { CutTagChoice } from "./size-bundle-rows";
import type { SplitCut } from "@/lib/folder-split-cuts";
import { describeOrders, piecesByOrder } from "@/lib/split-order-breakdown";
import { SplitSizeCell, describeGroups } from "./split-size-cell";
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

const DEFAULT_PERCENT = 40;

/**
 * REPARTO A DOS TALLERES: qué tallas van a uno y cuáles al otro.
 *
 * Se calcula en el navegador y no se guarda: es una ayuda para armar las dos
 * salidas, y un reparto guardado empezaría a mentir en cuanto alguien
 * corrigiera un bulto del corte.
 *
 * Los cortes se marcan uno por uno porque la salida a taller se hace por
 * tendido: lo que se reparte es lo que se va a cargar ahora, no el historial.
 *
 * Sin ningún corte reparte lo pedido, para planear antes de tender. Ahí sólo
 * calcula: el envío es de prendas ya cortadas, y mandar lo pedido pondría en un
 * vale bultos que nadie ha amarrado.
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

  /* Las tallas pasadas a mano de un lado al otro. Se borran al cambiar el
     porcentaje o los cortes: con otros números el cálculo propone otro
     reparto, y encimarle movimientos hechos para el anterior lo deja raro. */
  const [moves, setMoves] = useState<Map<string, SplitSide>>(() => new Map());

  const result = useMemo(() => {
    const bundles = cuts
      .filter((cut) => selected.has(cut.id))
      .flatMap((cut) => cut.bundles);
    return splitBundles(bundles, percent, moves);
  }, [cuts, selected, percent, moves]);

  function move(key: string, to: SplitSide) {
    setMoves((current) => new Map(current).set(key, to));
  }

  if (cuts.length === 0) return null;

  const rest = 100 - percent;
  const planned = cuts.some((cut) => cut.planned);

  function toggle(id: string) {
    setMoves(new Map());
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* Los números de corte que se repiten entre órdenes. Sólo de esos tiene
     sentido un atajo: con un corte por número, palomearlo es lo mismo. */
  const rounds = sharedRounds(cuts);

  function selectRound(round: string | null) {
    setMoves(new Map());
    setSelected(
      new Set(
        cuts
          .filter((cut) => round === null || cut.round === round)
          .map((cut) => cut.id),
      ),
    );
  }

  function handlePercent(raw: string) {
    const value = Number(raw);
    if (Number.isNaN(value)) return;
    setMoves(new Map());
    setPercent(Math.min(Math.max(Math.round(value), 0), 100));
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        buildMessage(result, percent, planned),
      );
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

        {planned && (
          <p className="border border-border bg-muted p-2 text-xs">
            <span className="font-medium">Todavía no hay corte:</span> se
            reparte sobre lo pedido. Sirve para planear; se podrá mandar a
            taller cuando se capture el corte.
          </p>
        )}

        {/* Con un solo corte no hay nada que elegir: la lista sólo estorbaría. */}
        {cuts.length > 1 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs text-muted-foreground">
              Cortes incluidos
            </legend>
            {rounds.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-2">
                <RoundButton
                  label="Todos"
                  active={selected.size === cuts.length}
                  onClick={() => selectRound(null)}
                />
                {rounds.map((round) => (
                  <RoundButton
                    key={round}
                    label={`Sólo ${round}`}
                    active={isOnlyRound(cuts, selected, round)}
                    onClick={() => selectRound(round)}
                  />
                ))}
              </div>
            )}
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
            se capturó antes de guardar los bultos reales: sus bultos se
            reconstruyeron juntando los pedazos de cada talla. Para dejarlos
            fijos abre <span className="font-medium">Corte global</span>,
            revisa que estén como se amarraron y guarda.
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
            shipping={planned ? undefined : shipping}
            planned={planned}
            onMove={move}
            adjusted={moves.size > 0}
            onReset={() => setMoves(new Map())}
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
  planned,
  onMove,
  adjusted,
  onReset,
}: {
  result: SplitResult;
  percent: number;
  onCopy: () => void;
  shipping?: SplitShipping;
  planned: boolean;
  onMove: (key: string, to: SplitSide) => void;
  /** Si alguna talla se pasó a mano: el reparto ya no es sólo el calculado. */
  adjusted: boolean;
  onReset: () => void;
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
        {deviationNote(withinTolerance, adjusted)}.
      </p>

      <ul className="flex flex-col">
        {result.sizes.map((size) => (
          <li
            key={size.sizeCode}
            className="grid grid-cols-[3.5rem_1fr_1fr] gap-2 border-t border-border py-1.5 text-sm"
          >
            <span className="tabular font-medium">{size.sizeCode}</span>
            <SplitSizeCell
              sizeCode={size.sizeCode}
              groups={size.first}
              pieces={size.firstPieces}
              piles={size.firstPiles}
              planned={planned}
              side="first"
              onMove={onMove}
            />
            <SplitSizeCell
              sizeCode={size.sizeCode}
              groups={size.second}
              pieces={size.secondPieces}
              piles={size.secondPiles}
              planned={planned}
              side="second"
              onMove={onMove}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {adjusted && (
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="touch-target w-full sm:w-auto"
          >
            <RotateCcw className="size-4" aria-hidden />
            Volver al calculado
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onCopy}
          className="touch-target w-full sm:w-auto"
        >
          <Copy className="size-4" aria-hidden />
          Copiar reparto
        </Button>
      </div>
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

/**
 * Por qué el reparto se aparta del porcentaje. Movido a mano ya no aplica la
 * explicación del cálculo: la diferencia la decidió quien movió.
 */
function deviationNote(withinTolerance: boolean, adjusted: boolean): string {
  if (adjusted) return " (con tallas pasadas a mano)";
  if (withinTolerance) return "";
  return ` (pasa de ${TOLERANCE_PIECES}: se parte a lo más una orden y cada talla va completa a un solo taller, así que no se puede acercar más)`;
}

/** El reparto como texto, para pegarlo en un mensaje o en el vale. */
function buildMessage(
  result: SplitResult,
  percent: number,
  planned: boolean,
): string {
  const lines = [
    `Reparto ${percent}% / ${100 - percent}% — total ${result.total} pzas${planned ? " (sobre lo pedido, sin corte)" : ""}`,
    `${percent}%: ${result.firstPieces} pzas · ${100 - percent}%: ${result.secondPieces} pzas`,
  ];

  for (const size of result.sizes) {
    lines.push(
      `Talla ${size.sizeCode}: ${percent}% → ${sideText(size.firstPieces, size.first, size.firstBundles, planned)} · ${100 - percent}% → ${sideText(size.secondPieces, size.second, size.secondBundles, planned)}`,
    );
  }

  return lines.join("\n");
}

function sideText(
  pieces: number,
  groups: SplitGroup[],
  bundles: SplitBundle[],
  planned: boolean,
): string {
  const orders = piecesByOrder(bundles);
  const byOrder = orders.length > 0 ? ` [${describeOrders(orders)}]` : "";
  if (planned) return `${pieces}${byOrder}`;
  return `${pieces} (${describeGroups(groups) || "—"})${byOrder}`;
}

/** Los nombres de corte que comparten dos o más órdenes, en orden de aparición. */
function sharedRounds(cuts: SplitCut[]): string[] {
  const counts = new Map<string, number>();
  for (const cut of cuts) {
    if (cut.round) counts.set(cut.round, (counts.get(cut.round) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([round]) => round)
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

/** Si lo palomeado es exactamente ese número de corte de todas las órdenes. */
function isOnlyRound(
  cuts: SplitCut[],
  selected: Set<string>,
  round: string,
): boolean {
  return cuts.every((cut) => selected.has(cut.id) === (cut.round === round));
}

function RoundButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className="touch-target"
    >
      {label}
    </Button>
  );
}
