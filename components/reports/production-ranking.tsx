import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ProducedRankRow } from "@/lib/services/report.service";
import { formatQuantity } from "@/lib/utils";
import { BarChart, type BarDatum } from "./bar-chart";

/**
 * Ranking de producciones por consumo de material.
 *
 * Arriba las tres cifras que se preguntan en junta —la que más gastó, la
 * mediana y la que menos— y debajo la lista completa. Las tres tarjetas
 * salen de la MISMA lista ordenada, así que nunca pueden contradecirse.
 */
export function ProductionRanking({ rows }: { rows: ProducedRankRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay salidas a producción en este periodo.
      </p>
    );
  }

  /* El acceso por índice puede dar undefined con `noUncheckedIndexedAccess`.
     Aquí ya sabemos que hay al menos un elemento —el early return de arriba
     lo garantiza—, pero se comprueba en vez de forzar con `!`: si mañana
     alguien mueve ese return, esto falla en compilación y no en la junta. */
  const top = rows[0];
  const bottom = rows[rows.length - 1];
  const middle = rows[Math.floor(rows.length / 2)];

  if (!top || !bottom || !middle) return null;

  /* El punto medio es el elemento CENTRAL de la lista ordenada, no el
     promedio: un promedio da una cifra que no corresponde a ninguna
     producción real, y en la junta alguien va a preguntar "¿cuál es ésa?". */
  const data: BarDatum[] = rows.map((row) => ({
    label: row.productionRunName,
    sublabel: row.clientName,
    value: row.quantity,
    tone: toneFor(row, top, bottom),
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Con una sola producción, "la que más" y "la que menos" son la misma
          y mostrar tres tarjetas iguales confundiría. */}
      {rows.length > 1 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <HighlightCard
            icon={ArrowUp}
            title="La que más consumió"
            row={top}
            tone="high"
          />
          <HighlightCard
            icon={Minus}
            title="Punto medio"
            row={middle}
            tone="mid"
          />
          <HighlightCard
            icon={ArrowDown}
            title="La que menos consumió"
            row={bottom}
            tone="low"
          />
        </div>
      )}

      <BarChart data={data} />
    </div>
  );
}

const TONE_STYLES: Record<string, string> = {
  high: "text-state-available",
  mid: "text-muted-foreground",
  low: "text-state-reserved",
};

function HighlightCard({
  icon: Icon,
  title,
  row,
  tone,
}: {
  icon: typeof ArrowUp;
  title: string;
  row: ProducedRankRow;
  tone: "high" | "mid" | "low";
}) {
  return (
    <div className="flat-surface p-3">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className={`size-3.5 ${TONE_STYLES[tone]}`} aria-hidden />
        {title}
      </p>
      <p className="mt-1.5 break-words text-sm font-medium">
        {row.productionRunName}
      </p>
      <p className="text-xs text-muted-foreground">{row.clientName}</p>
      <p className="tabular mt-1.5 text-xl font-semibold">
        {formatQuantity(row.quantity)}
      </p>
    </div>
  );
}

function toneFor(
  row: ProducedRankRow,
  top: ProducedRankRow,
  bottom: ProducedRankRow,
): BarDatum["tone"] {
  if (row.productionRunId === top.productionRunId) return "high";
  if (row.productionRunId === bottom.productionRunId) return "low";
  return "default";
}
