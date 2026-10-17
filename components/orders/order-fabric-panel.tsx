import Link from "next/link";
import { Plus, Scissors } from "lucide-react";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import type { FabricDocument, FabricSummary } from "@/lib/order-fabric";
import { formatDate, formatQuantity } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OrderFabric } from "@/components/orders/order-fabric";
import {
  OrderFabricReturnDialog,
  type ReturnableRoll,
} from "@/components/orders/order-fabric-return-dialog";

interface Props {
  orderId: string;
  orderCode: string;
  documents: FabricDocument[];
  summary: FabricSummary;
  returnableRolls: ReturnableRoll[];
  /** Capturar: sacar tela, seguir un borrador, devolver. */
  canEdit: boolean;
  /** Si el folio lleva al vale. Sin `inventory:browse` se pinta como texto. */
  canOpen: boolean;
}

/**
 * La pestaña de tela de la orden: sus botones de captura, los borradores que
 * siguen abiertos y el consumo.
 *
 * Los botones viven aquí y no en el encabezado de la ficha: allá competían
 * con capturar corte, imprimir y mandar a taller, y la tela tiene su lugar.
 */
export function OrderFabricPanel({
  orderId,
  orderCode,
  documents,
  summary,
  returnableRolls,
  canEdit,
  canOpen,
}: Props) {
  /* Los borradores de salida, aparte: un borrador NO ha descontado nada y es
     justo el vale al que se le siguen sumando rollos mientras se tiende. */
  const drafts = documents.filter(
    (doc) => doc.kind === "ISSUE" && doc.status === "DRAFT",
  );

  return (
    <>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button asChild className="touch-target">
            <Link href={`/issues/new?order=${orderId}`}>
              <Scissors className="size-4" aria-hidden />
              Nueva salida de tela
            </Link>
          </Button>
          {returnableRolls.length > 0 && (
            <OrderFabricReturnDialog
              orderId={orderId}
              orderCode={orderCode}
              rolls={returnableRolls}
            />
          )}
        </div>
      )}

      {canEdit && drafts.length > 0 && (
        <section className="flat-surface p-4">
          <h2 className="mb-1 text-sm font-semibold">Borradores abiertos</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            No han descontado nada. Súmales rollos y aplícalos desde el vale.
          </p>
          <ul className="flex flex-col gap-2">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <DraftRow draft={draft} canOpen={canOpen} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flat-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Tela</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no se le ha sacado tela a esta orden.
          </p>
        ) : (
          <OrderFabric
            documents={documents}
            summary={summary}
            canOpen={canOpen}
          />
        )}
      </section>
    </>
  );
}

function DraftRow({
  draft,
  canOpen,
}: {
  draft: FabricDocument;
  canOpen: boolean;
}) {
  const total = draft.lines.reduce((sum, line) => sum + line.quantity, 0);
  const unit = draft.lines[0] ? UNIT_SHORT_LABELS[draft.lines[0].unit] : "";
  const rolls = draft.lines.length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-border p-3">
      <div className="min-w-0">
        <p className="tabular text-sm font-medium">{draft.code}</p>
        <p className="tabular text-xs text-muted-foreground">
          {formatDate(draft.date)} · {rolls} {rolls === 1 ? "rollo" : "rollos"}{" "}
          · {formatQuantity(total, { unit })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canOpen && (
          <Button asChild variant="outline" className="touch-target">
            <Link href={`/documents/${draft.id}`}>Ver vale</Link>
          </Button>
        )}
        {/* La edición del borrador abre con sus renglones puestos: lo que
            se agregue ahí se suma a lo que ya llevaba. */}
        <Button asChild className="touch-target">
          <Link href={`/issues/${draft.id}/edit`}>
            <Plus className="size-4" aria-hidden />
            Agregar rollos
          </Link>
        </Button>
      </div>
    </div>
  );
}
