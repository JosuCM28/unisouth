import type { ProcessTrail } from "@/lib/services/workshop-process-trail";
import { formatDate, formatQuantity } from "@/lib/utils";
import { DeliveryStateBadge } from "./delivery-state-badge";

/** Si regresó a la planta no hay taller destino que nombrar. */
const PLANT_LABEL = "Planta";

/**
 * Por dónde anduvo la orden en bordado y serigrafía. Lo ve quien confecciona
 * para saber qué parte tiene cada taller ("las mangas las tiene Sitex") sin
 * tener que llamar. Sólo se lee: no lleva botones.
 */
export function ProcessTrailSection({ trail }: { trail: ProcessTrail }) {
  if (trail.sent.length === 0 && trail.outputs.length === 0) return null;

  return (
    <section className="flat-surface flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold">Bordado y serigrafía</h2>
      <SentList trail={trail} />
      <OutputList trail={trail} />
    </section>
  );
}

function SentList({ trail }: { trail: ProcessTrail }) {
  if (trail.sent.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">Enviado desde planta</h3>
      <ul className="flex flex-col">
        {trail.sent.map((entry) => (
          <li key={entry.code} className="flex flex-col gap-0.5 border-b border-border py-2 text-sm last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">A {entry.workshop}</span>
              <DeliveryStateBadge state={entry.state} />
            </div>
            <span className="tabular">
              {formatQuantity(entry.pieces)} pzas{entry.parts && ` · ${entry.parts}`}
            </span>
            <span className="tabular text-xs text-muted-foreground">
              {entry.code} · {formatDate(entry.date)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutputList({ trail }: { trail: ProcessTrail }) {
  if (trail.outputs.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">Salidas de los talleres</h3>
      <ul className="flex flex-col">
        {trail.outputs.map((output) => (
          <li key={output.code} className="flex flex-col gap-0.5 border-b border-border py-2 text-sm last:border-0">
            <span className="font-medium">
              {output.fromWorkshop} → {output.toWorkshop ?? PLANT_LABEL}
            </span>
            <span className="tabular">
              {formatQuantity(output.pieces)} pzas{output.parts && ` · ${output.parts}`}
            </span>
            <span className="tabular text-xs text-muted-foreground">
              {output.code} · {formatDate(output.date)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
