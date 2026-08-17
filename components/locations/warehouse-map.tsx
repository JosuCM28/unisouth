import { LOCATION_TYPE_LABELS } from "@/lib/constants/labels";
import type { LocationWithLotCount } from "@/lib/repositories/location.repository";
import { cn } from "@/lib/utils";

interface WarehouseMapProps {
  locations: LocationWithLotCount[];
}

/**
 * Mapa visual de la bodega: cada ubicación es una columna con su carga.
 *
 * Sirve para responder de un vistazo "¿dónde queda lugar?" sin leer una
 * tabla. La altura de la barra es proporcional a la ubicación más cargada,
 * no a la capacidad: casi ninguna la tiene capturada.
 */
export function WarehouseMap({ locations }: WarehouseMapProps) {
  const visible = locations.filter((location) => location.active);

  if (visible.length === 0) return null;

  const maxLots = Math.max(...visible.map((l) => l.lotCount), 1);

  return (
    <section className="flat-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Mapa de bodega</h2>
        <p className="text-xs text-muted-foreground">
          <span className="tabular">{visible.length}</span> ubicaciones
        </p>
      </div>

      {/* En celular se barre de lado: apilarlas verticalmente perdería la
          noción de "recorrido físico" que da el mapa. */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {visible.map((location) => (
          <WarehouseColumn
            key={location.id}
            location={location}
            maxLots={maxLots}
          />
        ))}
      </div>
    </section>
  );
}

function WarehouseColumn({
  location,
  maxLots,
}: {
  location: LocationWithLotCount;
  maxLots: number;
}) {
  const fillPercent = (location.lotCount / maxLots) * 100;
  const isEmpty = location.lotCount === 0;

  return (
    <div className="flex w-20 shrink-0 flex-col items-center gap-1.5">
      {/* La barra crece desde abajo, como se llena una fila de verdad. */}
      <div className="flex h-24 w-full items-end border border-border bg-secondary">
        <div
          className={cn(
            "w-full transition-[height]",
            isEmpty ? "h-0" : "bg-primary",
          )}
          style={{ height: `${fillPercent}%` }}
          aria-hidden
        />
      </div>

      <span className="tabular text-sm font-medium">{location.code}</span>
      <span className="tabular text-xs text-muted-foreground">
        {location.lotCount}
      </span>
      <span className="w-full truncate text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        {LOCATION_TYPE_LABELS[location.type]}
      </span>
    </div>
  );
}
