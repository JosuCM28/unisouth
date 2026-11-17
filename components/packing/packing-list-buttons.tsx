import Link from "next/link";
import { FileText, PencilLine } from "lucide-react";
import { ExportButton } from "@/components/shared/export-button";
import { Button } from "@/components/ui/button";

/**
 * El packing list del pedido. El PDF se abre en pestaña nueva —en el celular,
 * en su visor— para no perder el pedido; el Excel se descarga. Los dos salen
 * de la versión guardada si alguien la editó.
 */
export function PackingListButtons({ orderId, hasPieces }: { orderId: string; hasPieces: boolean }) {
  if (!hasPieces) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className="touch-target">
        <Link href={`/packing/${orderId}/packing-list`}>
          <PencilLine className="size-4" aria-hidden />
          Editar packing list
        </Link>
      </Button>
      <Button asChild variant="outline" className="touch-target">
        <a href={`/api/packing/${orderId}/pdf`} target="_blank" rel="noopener">
          <FileText className="size-4" aria-hidden />
          Packing list
        </a>
      </Button>
      <ExportButton href={`/api/export/packing/${orderId}`} label="Excel" exact />
    </div>
  );
}
