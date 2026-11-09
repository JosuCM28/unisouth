import { formatQuantity } from "@/lib/utils";

export interface VerticalBarDatum {
  key: string;
  value: number;
  caption: string;
  subcaption?: string;
}

/** Alto de la barra más alta, en rem. */
const MAX_BAR_REM = 8;

/**
 * Barras verticales en HTML plano, por la misma razón que `BarChart`: el
 * contrato del proyecto no admite una librería de gráficas.
 *
 * Reparte el ancho en columnas iguales en vez de darles un ancho fijo: catorce
 * días tienen que caber en 343px sin que la gráfica haga scroll. La cifra de
 * cada barra se esconde en celular porque ahí no cabe; la tabla de abajo de
 * cada gráfica la da completa.
 */
export function VerticalBars({ data }: { data: VerticalBarDatum[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <div
      className="grid gap-0.5 sm:gap-1"
      style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {data.map((item) => (
        <div key={item.key} className="flex min-w-0 flex-col items-center">
          <div className="flex h-40 w-full flex-col items-center justify-end border-b border-border">
            {item.value > 0 && (
              <span className="tabular mb-0.5 hidden text-[10px] leading-none sm:block">
                {formatQuantity(item.value, { decimals: 0 })}
              </span>
            )}
            <div
              className="w-full max-w-10 bg-primary"
              style={{ height: barHeight(item.value, max) }}
            />
          </div>
          <span className="tabular mt-1 text-[10px] leading-none text-foreground">
            {item.caption}
          </span>
          {item.subcaption && (
            <span className="text-[10px] leading-tight text-muted-foreground">
              {item.subcaption}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Un mínimo visible: un día con poco corte no debe confundirse con uno en cero. */
function barHeight(value: number, max: number): string {
  if (value <= 0) return "0";
  return `max(2px, ${(value / max) * MAX_BAR_REM}rem)`;
}
