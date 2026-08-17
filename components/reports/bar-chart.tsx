import { cn, formatQuantity } from "@/lib/utils";

export interface BarDatum {
  label: string;
  sublabel?: string;
  value: number;
  /** Resalta esta barra (el máximo, el mínimo). */
  tone?: "default" | "high" | "low";
}

/**
 * Gráfica de barras horizontales, en HTML plano.
 *
 * Horizontales y no verticales a propósito: las etiquetas son nombres de
 * producción ("Overol gasera Ternium") y en vertical habría que girarlas o
 * cortarlas. Además así la lista crece hacia abajo, que es como se lee en un
 * celular.
 *
 * Sin librería de gráficas: son divs con un ancho porcentual. Una dependencia
 * de 100 kB para pintar barras no se justifica, y el contrato del proyecto
 * prohíbe agregar librerías nuevas.
 */
export function BarChart({
  data,
  unit,
  emptyLabel = "Sin datos en el periodo.",
}: {
  data: BarDatum[];
  unit?: string;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  // El máximo define la escala. Si todo es cero no se divide entre cero: se
  // pintan todas las barras vacías, que es lo honesto.
  const max = Math.max(...data.map((item) => item.value));

  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((item) => (
        <li key={item.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">
              {item.label}
              {item.sublabel && (
                <span className="text-muted-foreground"> · {item.sublabel}</span>
              )}
            </span>
            <span className="tabular shrink-0 font-medium">
              {formatQuantity(item.value, { unit })}
            </span>
          </div>

          {/* La barra es decorativa: el dato ya se leyó arriba en número, así
              que se oculta a lectores de pantalla en vez de duplicarlo. */}
          <div
            className="h-2 w-full border border-border bg-muted"
            aria-hidden
          >
            <div
              className={cn("h-full", TONE_CLASSES[item.tone ?? "default"])}
              style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Colores por tono. Fondo sólido, sin degradado: el sistema es flat y la
 * pantalla se ve con mala luz.
 */
const TONE_CLASSES: Record<NonNullable<BarDatum["tone"]>, string> = {
  default: "bg-primary",
  high: "bg-state-available",
  low: "bg-state-reserved",
};
