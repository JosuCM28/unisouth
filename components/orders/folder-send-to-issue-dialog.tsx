"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Truck } from "lucide-react";
import { toast } from "sonner";
import { sendFolderToIssueAction } from "@/app/actions/order-folder.actions";
import { runAction } from "@/lib/offline/run-action";
import type { PreviewSize, PreviewSkip } from "@/lib/folder-send-preview";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  folderId: string;
  folderCode: string;
  /** Tallas que van a viajar, ya juntadas de todas las órdenes. */
  sizes: PreviewSize[];
  pieces: number;
  bundles: number;
  /** De cuántas órdenes salen esas piezas. */
  orders: number;
  /** Cortes que no viajan porque ya salieron, con el vale en el que salieron. */
  skipped: PreviewSkip[];
  /** Clientes distintos en el pedido. Con más de uno el vale no procede. */
  clients: number;
}

/**
 * LA SALIDA GLOBAL: un solo vale con lo cortado de todo el pedido.
 *
 * El taller se lleva las prendas de las cinco órdenes en el mismo viaje, y
 * mandarlas una por una son cinco papeles y cinco firmas para una sola
 * entrega.
 *
 * Enseña ANTES de crear nada qué tallas viajan y cuántos bultos: el vale nace
 * con folio de la serie OUT y enterarse después de que salió mal obliga a
 * cancelarlo.
 */
export function FolderSendToIssueDialog({
  folderId,
  folderCode,
  sizes,
  pieces,
  bundles,
  orders,
  skipped,
  clients,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /* Con dos dueños el vale ni se intenta: el servidor lo rechaza igual, pero
     dejar el botón vivo obliga a apretarlo para enterarse. */
  const mixedClients = clients > 1;
  const canSend = sizes.length > 0 && !mixedClients;

  async function handleSend() {
    setIsSaving(true);
    const result = await runAction(() =>
      sendFolderToIssueAction({ id: folderId }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`Borrador ${result.data.code} creado`);
    setOpen(false);

    /* Derecho a editar el borrador: lo que sigue es completar el vale —los
       rollos, quién recibe— y dejarlo en la lista obligaría a buscarlo. */
    router.push(`/issues/${result.data.id}/edit`);
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Salida global · ${folderCode}`}
      description="Un solo vale con lo cortado de todas las órdenes del pedido. No mueve inventario todavía."
      trigger={
        <Button variant="outline" className="touch-target">
          <Truck className="size-4" aria-hidden />
          Salida global
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {mixedClients && (
          <Warning>
            Este pedido tiene órdenes de{" "}
            <span className="font-medium">{clients} clientes distintos</span> y
            no puede salir en un solo vale: la tela de un cliente nunca se surte
            para la producción de otro. Mándalas por separado desde cada orden.
          </Warning>
        )}

        {/* Lo que NO viaja se dice primero: si el auxiliar esperaba el pedido
            completo, más vale que lo sepa antes de firmar el vale. */}
        {skipped.length > 0 && (
          <Warning>
            {skipped.length === 1
              ? "Un corte no viaja porque ya salió"
              : `${skipped.length} cortes no viajan porque ya salieron`}
            :{" "}
            <span className="tabular font-medium">
              {skipped
                .map((cut) => `${cut.orderCode} ${cut.batch} → ${cut.issueCode}`)
                .join(" · ")}
            </span>
            . Cancela esas salidas si necesitas volver a mandarlos.
          </Warning>
        )}

        {sizes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {skipped.length > 0
              ? "Todo lo cortado de este pedido ya salió."
              : "Este pedido todavía no tiene piezas cortadas que entregar."}
          </p>
        ) : (
          <div className="flat-surface p-3">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">Van a viajar</span>
              <span className="tabular text-sm">
                {pieces} {pieces === 1 ? "prenda" : "prendas"} · {bundles}{" "}
                {bundles === 1 ? "bulto" : "bultos"}
              </span>
            </div>

            <ul className="flex flex-col gap-1">
              {sizes.map((size) => (
                <li
                  key={size.sizeId}
                  className="tabular flex items-baseline justify-between gap-3 text-xs text-muted-foreground"
                >
                  <span>Talla {size.sizeCode}</span>
                  <span>
                    {size.pieces} · {size.bundles}{" "}
                    {size.bundles === 1 ? "bulto" : "bultos"}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
              De {orders} {orders === 1 ? "orden" : "órdenes"} del pedido.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Del encabezado sólo se copia lo que todas las órdenes comparten —tela,
          molde, versión—; lo que difiere se deja en blanco para que no salga un
          dato falso en el papel. Las anotaciones de cada talla viajan tal cual
          y los bultos idénticos se juntan en un renglón.
        </p>

        <Button
          type="button"
          onClick={handleSend}
          disabled={isSaving || !canSend}
          className="h-12 w-full"
        >
          <Truck className="size-4" aria-hidden />
          {isSaving ? "Creando borrador…" : "Crear salida global"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}

/** Aviso con borde de estado. Se repite lo suficiente para valer su nombre. */
function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 border border-state-reserved bg-card p-3 text-sm">
      <AlertTriangle
        className="size-4 shrink-0 text-state-reserved"
        aria-hidden
      />
      <span>{children}</span>
    </p>
  );
}
