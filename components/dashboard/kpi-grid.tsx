import {
  AlertTriangle,
  Boxes,
  Calculator,
  Clock,
  PackageSearch,
  Ruler,
  Scissors,
  ShoppingCart,
} from "lucide-react";
import type { DashboardKpis } from "@/lib/services/dashboard.service";
import { KpiCard, type KpiTone } from "./kpi-card";

/**
 * Decide el tono según qué tan alto sea el número.
 *
 * Se hace con `if` y salida temprana en vez de ternarias anidadas, que es
 * justo lo que prohíbe la regla 1 del contrato.
 */
export function toneForCount(
  value: number,
  warningAt: number,
  criticalAt: number,
): KpiTone {
  if (value >= criticalAt) return "critical";
  if (value >= warningAt) return "warning";
  return "neutral";
}

interface KpiGridProps {
  kpis: DashboardKpis;
}

export function KpiGrid({ kpis }: KpiGridProps) {
  return (
    // 2 columnas en celular: con 1 hay que hacer scroll eterno, con 4 no se lee.
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Rollos en bodega"
        value={kpis.lotesEnBodega}
        icon={Boxes}
        href="/lots"
      />

      <KpiCard
        label="Por medir"
        value={kpis.porMedir}
        hint="Metraje sin confirmar"
        icon={Ruler}
        tone={toneForCount(kpis.porMedir, 5, 20)}
        href="/lots?verified=false"
      />

      <KpiCard
        label="Retazos"
        value={kpis.retazos}
        hint="Se surten primero"
        icon={Scissors}
        href="/lots?remnant=true"
      />

      <KpiCard
        label="Sin mover 90 días"
        value={kpis.sinMover90Dias}
        icon={Clock}
        tone={toneForCount(kpis.sinMover90Dias, 5, 15)}
      />

      <KpiCard
        label="Bajo reorden"
        value={kpis.materialesBajoReorden}
        hint="Hay que comprar"
        icon={PackageSearch}
        tone={toneForCount(kpis.materialesBajoReorden, 1, 5)}
        href="/materials"
      />

      <KpiCard
        label="Movimientos hoy"
        value={kpis.movimientosHoy}
        icon={Boxes}
        tone="positive"
      />

      <KpiCard
        label="Cálculos con faltante"
        value={kpis.calculosConFaltante}
        icon={Calculator}
        tone={toneForCount(kpis.calculosConFaltante, 1, 3)}
        href="/calculations"
      />

      <KpiCard
        label="Requisiciones abiertas"
        value={kpis.requisicionesAbiertas}
        icon={ShoppingCart}
        tone={toneForCount(kpis.requisicionesAbiertas, 3, 10)}
        href="/purchase-requests"
      />
    </div>
  );
}

/** Aviso cuando algo del tablero no pudo calcularse. */
export function KpiGridError() {
  return (
    <div className="flat-surface flex items-center gap-3 p-4">
      <AlertTriangle className="size-5 text-state-defective" aria-hidden />
      <p className="text-sm text-muted-foreground">
        No se pudieron cargar los indicadores.
      </p>
    </div>
  );
}
