import { WorkshopOutputService } from "@/lib/services/workshop-output.service";
import { OutputCancelButton } from "@/components/workshop-outputs/output-cancel-button";
import { OutputCard } from "@/components/workshop-outputs/output-card";

/**
 * Lo que los talleres sacaron de esta orden: la cadena que la casa lee
 * cuando pregunta "¿dónde quedaron los frentes bordados?".
 *
 * Lee sus propios datos para no engordar la página de la orden. Si ningún
 * taller ha sacado nada, no se pinta.
 */
export async function OrderWorkshopOutputs({
  orderId,
  canCancel,
}: {
  orderId: string;
  /** ADMIN corrige la salida de cualquier taller (`cuts:unlock`). */
  canCancel: boolean;
}) {
  const outputs = await new WorkshopOutputService().listForOrder(orderId);
  if (outputs.length === 0) return null;

  return (
    <section className="flat-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">Salidas de talleres</h2>
      <ul className="flex flex-col gap-2">
        {outputs.map((output) => (
          <OutputCard
            key={output.id}
            output={output}
            showWorkshop
            action={canCancel ? <OutputCancelButton id={output.id} code={output.code} asAdmin /> : undefined}
          />
        ))}
      </ul>
    </section>
  );
}
