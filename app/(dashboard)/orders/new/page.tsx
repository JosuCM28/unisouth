import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Copy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { getOrderFormOptions } from "@/lib/order-form-options";
import { todayInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { OrderForm, type EditableOrder } from "@/components/orders/order-form";

export const metadata: Metadata = { title: "Nueva orden" };

interface PageProps {
  /** Vienen de la ficha del pedido, para no volver a teclear lo que ya sabe. */
  searchParams: Promise<{
    folder?: string;
    client?: string;
    due?: string;
    /** Orden de la que se copia la base de tallas y el encabezado. */
    from?: string;
  }>;
}

export default async function NewOrderPage({ searchParams }: PageProps) {
  await requirePermission("inventory:write");

  const [options, params] = await Promise.all([
    getOrderFormOptions(),
    searchParams,
  ]);

  const source = params.from ? await loadTemplate(params.from) : null;

  /* Sólo se precarga la carpeta si de verdad existe y está viva: un id
     inventado en la URL dejaría el selector en un valor que no está entre las
     opciones, y el formulario se guardaría sin pedido sin avisar. */
  const folderId = options.folders.some((folder) => folder.id === params.folder)
    ? params.folder
    : undefined;
  const clientId = options.clients.some((client) => client.id === params.client)
    ? params.client
    : undefined;

  const backHref = source
    ? `/orders/${source.id}`
    : folderId
      ? `/orders/folders/${folderId}`
      : "/orders";

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={backHref}
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {source ? source.code : folderId ? "Pedido" : "Órdenes"}
      </Link>

      <PageHeader
        title={source ? `Duplicar ${source.code}` : "Nueva orden"}
        description={
          source
            ? "Ajusta lo que cambie y guarda. La orden original no se toca."
            : "Qué pidieron y de cuántas tallas"
        }
      />

      {/* Qué se copió y qué no. Se dice de frente porque los dos campos que
          se dejan vacíos —la referencia del cliente y la fecha de entrega—
          son justo los que se pasarían por alto, y arrastrarlos haría que dos
          órdenes distintas dijeran ser el mismo papel. */}
      {source && (
        <p className="flex items-start gap-2 border border-border bg-card p-3 text-sm">
          <Copy className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Copiado de{" "}
            <span className="tabular font-medium">{source.code}</span>:{" "}
            {source.template.lines.length}{" "}
            {source.template.lines.length === 1 ? "talla" : "tallas"}, cliente,
            tela y el encabezado del corte. La referencia y la fecha de entrega
            se dejan en blanco, y nada del avance se copia.
          </span>
        </p>
      )}

      <OrderForm
        clients={options.clients}
        materials={options.materials}
        productionRuns={options.productionRuns}
        sizes={options.sizes}
        tags={options.tags}
        folders={options.folders}
        order={source?.template}
        duplicating={Boolean(source)}
        defaults={{ folderId, clientId, dueDate: params.due }}
      />
    </div>
  );
}

/**
 * La orden que se copia, servida con la forma que espera el formulario.
 *
 * Lo que se reaprovecha es el PEDIDO —la base de tallas y el encabezado del
 * corte—, nunca lo que ya pasó con la orden original: el avance, los cortes,
 * los envíos y las salidas se quedan donde están. Una orden duplicada nace
 * con cero cortadas, que es lo único honesto.
 *
 * Una orden CANCELADA sí se puede duplicar, aunque no se pueda editar: que se
 * haya caído no invalida su base de tallas, y rehacerla es justo lo que se
 * hace después de cancelarla.
 *
 * Se devuelve `null` en silencio si el id no existe: la pantalla cae de pie
 * como un alta normal en vez de reventar por un parámetro tecleado a mano.
 */
async function loadTemplate(id: string) {
  const order = await prisma.cuttingOrder.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } } },
  });

  if (!order) return null;

  const template: EditableOrder = {
    // El id es el de la orden ORIGINAL y el formulario no lo usa para guardar
    // —con `duplicating` sabe que va a crear—. Está aquí porque el tipo lo
    // pide y porque es lo que permite volver a la orden de la que se copió.
    id: order.id,
    clientId: order.clientId,
    materialId: order.materialId,
    productionRunId: order.productionRunId,
    folderId: order.folderId,
    description: order.description,
    /* La referencia NO se copia: es el número que trae el papel del cliente,
       y dos órdenes distintas diciendo ser el mismo papel es exactamente el
       enredo que después nadie puede desatar. */
    reference: null,
    // Se pide HOY, no el día de la original.
    orderedAt: todayInputValue(),
    // La fecha de entrega es de aquel compromiso, no de éste.
    dueDate: null,
    notes: order.notes,
    cutHeader: {
      cutFabricText: order.cutFabricText ?? "",
      cutPattern: order.cutPattern ?? "",
      cutVersion: order.cutVersion ?? "",
      cutVersionNotes: order.cutVersionNotes ?? "",
      cutNotes: order.cutNotes,
    },
    lines: order.lines.map((line) => ({
      /* Llave nueva y SIN `id`: con el id del renglón original, guardar
         intentaría actualizar renglones que pertenecen a la otra orden.
         Tampoco viaja `locked`: la orden nueva no tiene avance que proteger. */
      key: crypto.randomUUID(),
      sizeId: line.sizeId,
      orderedQuantity: String(line.orderedQuantity),
      tagId: line.tagId ?? "",
      notes: line.notes ?? "",
    })),
  };

  return { id: order.id, code: order.code, template };
}
