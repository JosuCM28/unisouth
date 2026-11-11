"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import type { SplitGroup, SplitPile, SplitSide } from "@/lib/workshop-split";
import { describeOrders, piecesByOrder } from "@/lib/split-order-breakdown";
import { Button } from "@/components/ui/button";

/** El lado contrario: a donde manda la flecha. */
const OTHER_SIDE: Record<SplitSide, SplitSide> = {
  first: "second",
  second: "first",
};

/**
 * Lo que le toca a un lado de una talla, con una flecha por cada orden para
 * pasarla al otro taller.
 *
 * La flecha mueve la talla de UNA orden, no la talla del pedido entero: es lo
 * que el cálculo trata como pieza mínima, y lo que hace falta cuando a un lado
 * le faltan unas cuantas piezas —pasar los 9 de la 50 de una orden, no los de
 * todas—.
 */
export function SplitSizeCell({
  sizeCode,
  groups,
  pieces,
  piles,
  planned,
  side,
  onMove,
}: {
  sizeCode: string;
  groups: SplitGroup[];
  pieces: number;
  piles: SplitPile[];
  /** Sobre lo pedido no hay bultos que enseñar: nadie ha amarrado nada. */
  planned: boolean;
  side: SplitSide;
  onMove: (key: string, to: SplitSide) => void;
}) {
  if (piles.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="tabular flex flex-col">
      <span className="font-medium">{pieces}</span>
      {!planned && (
        <span className="text-xs text-muted-foreground">
          {describeGroups(groups)}
        </span>
      )}
      {piles.map((pile) => (
        <PileRow
          key={pile.key}
          sizeCode={sizeCode}
          pile={pile}
          side={side}
          onMove={onMove}
        />
      ))}
    </span>
  );
}

function PileRow({
  sizeCode,
  pile,
  side,
  onMove,
}: {
  sizeCode: string;
  pile: SplitPile;
  side: SplitSide;
  onMove: (key: string, to: SplitSide) => void;
}) {
  // Sin folio es una orden suelta: no hay de quién decir, sólo cuántas.
  const orders = describeOrders(piecesByOrder(pile.bundles));
  const label = orders || `${pile.pieces} pzas`;
  const Arrow = side === "first" ? ArrowRight : ArrowLeft;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onMove(pile.key, OTHER_SIDE[side])}
        className="touch-target shrink-0"
        aria-label={`Pasar la talla ${sizeCode} (${label}) al otro taller`}
        title="Pasar al otro taller"
      >
        <Arrow className="size-4" aria-hidden />
      </Button>
    </span>
  );
}

/** "2 × 60 + 1 × 50": los bultos, tal como se cuentan en la mesa. */
export function describeGroups(groups: SplitGroup[]): string {
  return groups.map((group) => `${group.count}×${group.pieces}`).join(" + ");
}
