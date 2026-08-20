import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import type { MaterialHistoryKpis } from "@/lib/material-history";
import { cn, formatQuantity } from "@/lib/utils";

/**
 * Lo que entró y salió del material en la ventana consultada.
 *
 * Responde de un vistazo la pregunta que se hace al cerrar un turno:
 * "hoy de 6 a 8 entraron 50 rollos con 7,000 metros". Por eso cada tarjeta
 * lleva las DOS magnitudes: los metros son la tela, los rollos son el trabajo
 * de acomodarla, y planear con una sola de las dos sale mal.
 *
 * Server Component: son números ya resueltos, sin estado ni eventos.
 */
export function MaterialKpis({ kpis }: { kpis: MaterialHistoryKpis }) {
  const unitLabel = UNIT_SHORT_LABELS[kpis.unit];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <KpiCard
        label="Entraron"
        icon={ArrowDownLeft}
        tone="in"
        quantity={kpis.inbound.quantity}
        lots={kpis.inbound.lots}
        movements={kpis.inbound.movements}
        unitLabel={unitLabel}
      />

      <KpiCard
        label="Salieron"
        icon={ArrowUpRight}
        tone="out"
        quantity={kpis.outbound.quantity}
        lots={kpis.outbound.lots}
        movements={kpis.outbound.movements}
        unitLabel={unitLabel}
      />

      <NetCard net={kpis.net} unitLabel={unitLabel} />
    </div>
  );
}

const TONE_STYLES = {
  in: "text-state-available",
  out: "text-state-defective",
} as const;

interface KpiCardProps {
  label: string;
  icon: LucideIcon;
  tone: keyof typeof TONE_STYLES;
  quantity: number;
  lots: number;
  movements: number;
  unitLabel: string;
}

function KpiCard({
  label,
  icon: Icon,
  tone,
  quantity,
  lots,
  movements,
  unitLabel,
}: KpiCardProps) {
  return (
    <section className="flat-surface p-3">
      <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("size-3.5", TONE_STYLES[tone])} aria-hidden />
        {label}
      </h3>

      {/* Los metros mandan: es el número que se compara contra el pedido. */}
      <p className={cn("tabular mt-1 text-2xl font-bold leading-none", TONE_STYLES[tone])}>
        {formatQuantity(quantity, { unit: unitLabel })}
      </p>

      <p className="tabular mt-1 text-xs text-muted-foreground">
        {lots} {lots === 1 ? "rollo" : "rollos"}
        {/* Los asientos sólo se nombran cuando difieren de los rollos: si
            coinciden, repetir el número hace dudar de cuál es cuál. */}
        {movements !== lots && ` · ${movements} mov.`}
      </p>
    </section>
  );
}

/**
 * El neto: cuánto creció o se encogió la pila en la ventana.
 *
 * Se muestra con signo explícito porque un "−1,200 m" y un "1,200 m" son
 * noticias opuestas, y sin el signo habría que ir a comparar las otras dos
 * tarjetas para saber cuál de las dos es.
 */
/** Signo y color del neto, resueltos con salidas tempranas y no con ternarias
    encadenadas: son tres casos con significado propio. */
function netStyle(net: number): { sign: string; tone: string } {
  if (net > 0) return { sign: "+", tone: "text-state-available" };
  if (net < 0) return { sign: "−", tone: "text-state-defective" };
  return { sign: "", tone: "text-muted-foreground" };
}

function NetCard({ net, unitLabel }: { net: number; unitLabel: string }) {
  const { sign, tone } = netStyle(net);

  return (
    <section className="flat-surface col-span-2 p-3 md:col-span-1">
      <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Scale className="size-3.5" aria-hidden />
        Neto del periodo
      </h3>

      <p className={cn("tabular mt-1 text-2xl font-bold leading-none", tone)}>
        {sign}
        {formatQuantity(Math.abs(net), { unit: unitLabel })}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        Entradas menos salidas
      </p>
    </section>
  );
}
