import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  FolderOpen,
  Pencil,
  Plus,
  StickyNote,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { sumBundlePieces } from "@/lib/bundles";
import {
  CUT_VERSION_LABELS,
  cutBatchLabel,
  CUTTING_ORDER_STATUS_LABELS,
  CUTTING_ORDER_STATUS_STYLES,
} from "@/lib/constants/labels";
import {
  cn,
  contrastText,
  cutProgress,
  formatDate,
  formatDateTime,
} from "@/lib/utils";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ExportButton } from "@/components/shared/export-button";
import { OrderProgressDialog } from "@/components/orders/order-progress-dialog";
import { OrderCancelDialog } from "@/components/orders/order-cancel-dialog";
import { OrderMoveDialog } from "@/components/orders/order-move-dialog";
import { OrderSendToIssueDialog } from "@/components/orders/order-send-to-issue-dialog";
import { OrderShipmentDialog } from "@/components/orders/order-shipment-dialog";
import {
  OrderBatchDialog,
  type BatchOption,
} from "@/components/orders/order-batch-dialog";
import {
  OrderBatches,
  type BatchView,
} from "@/components/orders/order-batches";
import {
  OrderShipments,
  type ShipmentView,
} from "@/components/orders/order-shipments";
import {
  OrderIssues,
  type IssueView,
} from "@/components/orders/order-issues";
import {
  OrderComments,
  type OrderCommentView,
} from "@/components/orders/order-comments";
import { GarmentShipmentService } from "@/lib/services/garment-shipment.service";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await prisma.cuttingOrder.findUnique({
    where: { id },
    select: { code: true },
  });
  return { title: order?.code ?? "Orden" };
}

/**
 * Ficha de una orden: lo pedido, lo cortado y lo que falta.
 *
 * Es la pantalla del día a día: se abre para registrar cuánto se cortó y para
 * saber qué queda pendiente sin tener que sumar a mano.
 */
export default async function OrderDetailPage({ params }: PageProps) {
  await requirePermission("inventory:browse");

  const { id } = await params;
  // Para saber si se le ofrece escribir comentarios internos: leerlos sólo
  // pide `browse`, que la línea de arriba ya exigió.
  const user = await getCurrentUser();
  const canComment = user
    ? roleHasPermission(user.role, "inventory:write")
    : false;

  const order = await prisma.cuttingOrder.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      material: { select: { name: true, code: true } },
      productionRun: { select: { code: true, name: true } },
      folder: { select: { id: true, code: true, name: true } },
      createdBy: { select: { name: true } },
      lines: {
        orderBy: { position: "asc" },
        include: {
          size: { select: { code: true, name: true } },
          cutTag: { select: { name: true, color: true } },
          progress: {
            orderBy: { createdAt: "desc" },
            include: { user: { select: { name: true } } },
          },
        },
      },
      /* Los cortes, del más nuevo al más viejo: el que se está capturando es
         el último y tiene que quedar arriba, tanto en la ficha como en el
         selector del diálogo. */
      batches: {
        orderBy: { number: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      /* Los comentarios internos, del más nuevo al más viejo: lo último que
         se acordó es lo que se necesita leer al abrir la orden. */
      comments: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  if (!order) notFound();

  // Para el diálogo de mover: los pedidos vivos a los que puede ir la orden.
  const folders = (
    await prisma.orderFolder.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  ).map((folder) => ({
    id: folder.id,
    name: folder.name,
    hint: [folder.code, folder.client?.name].filter(Boolean).join(" · "),
  }));

  /* El tablero de prendas: cuánto de cada talla está aquí y cuánto anda en
     un taller. Se calcula sumando envíos y retornos, nunca leyendo un campo. */
  const [balances, shipments, workshops, stages, issues] = await Promise.all([
    new GarmentShipmentService().balances(id),
    prisma.garmentShipment.findMany({
      where: { orderId: id },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      include: {
        workshop: { select: { name: true } },
        stage: { select: { name: true } },
        document: { select: { id: true, code: true, status: true } },
        lines: {
          orderBy: { position: "asc" },
          include: { size: { select: { code: true } } },
        },
      },
    }),
    prisma.workshop.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.processStage.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    /* Las salidas nacidas de esta orden.

       Se buscan por la LLAVE y no por el texto de la referencia: dos órdenes
       del mismo cliente pueden traer el mismo número de papel, y cruzar por
       ahí acabaría colgándole a esta orden la salida de otra. Los vales de
       envío a taller no salen aquí a propósito: ya se pintan en "En talleres"
       y aparecerían dos veces. */
    prisma.inventoryDocument.findMany({
      where: { cuttingOrderId: id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        status: true,
        date: true,
        cuttingBatchId: true,
        receivedBy: true,
        _count: { select: { cutLines: true } },
        cutLines: { select: { quantity: true } },
      },
    }),
  ]);

  const shipmentViews: ShipmentView[] = shipments.map((shipment) => ({
    id: shipment.id,
    code: shipment.code,
    status: shipment.status,
    workshopName: shipment.workshop.name,
    stageName: shipment.stage.name,
    sentAt: shipment.sentAt,
    reference: shipment.reference,
    parts: shipment.parts,
    document: shipment.document
      ? {
          id: shipment.document.id,
          code: shipment.document.code,
          isDraft: shipment.document.status === "DRAFT",
        }
      : null,
    lines: shipment.lines.map((line) => ({
      id: line.id,
      sizeCode: line.size.code,
      sentQuantity: line.sentQuantity,
      bundles: line.bundles,
      returnedQuantity: line.returnedQuantity,
      scrapQuantity: line.scrapQuantity,
    })),
  }));

  const shippableSizes = order.lines.map((line) => {
    const balance = balances.get(line.sizeId);

    return {
      sizeId: line.sizeId,
      sizeCode: line.size.code,
      cut: line.cutQuantity,
      /* Lo ya mandado a cada etapa. El diálogo enseña el de la etapa elegida:
         "de la 34 ya van 100 a bordado de 1330 cortadas". */
      sentByStage: Object.fromEntries(
        [...(balance?.byStage.values() ?? [])].map((stage) => [
          stage.stageId,
          stage.sent,
        ]),
      ),
    };
  });

  const ordered = order.lines.reduce((s, l) => s + l.orderedQuantity, 0);
  const cut = order.lines.reduce((s, l) => s + l.cutQuantity, 0);
  const { pending, surplus } = cutProgress(ordered, cut);
  const isCancelled = order.status === "CANCELLED";

  /* Lo que viajaría a un vale de salida: sólo las tallas con corte, porque
     lo que sale por la puerta son las prendas que ya existen. Se calcula
     aquí para poder enseñarlo ANTES de crear el borrador. */
  const issueSizes = order.lines
    .filter((line) => line.cutQuantity > 0)
    .map((line) => ({ sizeCode: line.size.code, quantity: line.cutQuantity }));

  // Sin nada cortado no hay nada que entregar y el botón no se ofrece: la
  // orden se manda cuando el taller ya cortó, no antes.
  const canSendToIssue = !isCancelled && issueSizes.length > 0;

  // El encabezado del corte sólo se pinta si alguien lo llenó.
  const hasCutHeader = Boolean(
    order.cutFabricText ||
      order.cutPattern ||
      order.cutVersion ||
      order.cutVersionNotes ||
      order.cutNotes.length > 0,
  );

  /* Todos los avances de la orden, del más reciente al más viejo. Se aplanan
     desde las tallas porque la bitácora cuelga del renglón, no del corte. */
  const history = order.lines
    .flatMap((line) =>
      line.progress.map((entry) => ({ ...entry, sizeCode: line.size.code })),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Cada corte con las capturas que le pertenecen.
  const batchViews: BatchView[] = order.batches.map((batch) => ({
    id: batch.id,
    number: batch.number,
    label: batch.label,
    notes: batch.notes,
    openedAt: batch.openedAt,
    openedByName: batch.createdBy?.name ?? null,
    entries: history
      .filter((entry) => entry.batchId === batch.id)
      .map((entry) => ({
        id: entry.id,
        sizeCode: entry.sizeCode,
        quantity: entry.quantity,
        bundles: entry.bundles,
        createdAt: entry.createdAt,
        userName: entry.user?.name ?? null,
        notes: entry.notes,
      })),
    issues: issues
      .filter((issue) => issue.cuttingBatchId === batch.id)
      .map((issue) => ({
        id: issue.id,
        code: issue.code,
        status: issue.status,
      })),
  }));

  const commentViews: OrderCommentView[] = order.comments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    authorName: comment.createdBy?.name ?? null,
  }));

  /* Las salidas que siguen en pie. Es el indicador que contesta "¿esta orden
     ya salió?": una cancelada no cuenta porque cancelar es justo cómo se
     deshace un envío equivocado. */
  const liveIssues = issues.filter((issue) => issue.status !== "CANCELLED");

  const issueViews: IssueView[] = issues.map((issue) => ({
    id: issue.id,
    code: issue.code,
    status: issue.status,
    date: issue.date,
    receivedBy: issue.receivedBy,
    // El corte del que salió, por su nombre de piso ("1er corte"). Sin corte
    // el vale cubre la orden completa, que también hay que poder distinguir.
    batchLabel: batchLabelOf(order.batches, issue.cuttingBatchId),
    pieces: issue.cutLines.reduce((sum, line) => sum + line.quantity, 0),
    sizes: issue._count.cutLines,
  }));

  /* Lo que necesitan los dos diálogos de captura: el corte al que cargar las
     piezas y cuánto lleva cada uno, para reconocerlo en el selector. */
  const batchOptions: BatchOption[] = batchViews.map((batch) => ({
    id: batch.id,
    number: batch.number,
    label: batch.label,
    openedAt: batch.openedAt,
    // Cantidad × bultos, igual que en la tarjeta del corte.
    pieces: sumBundlePieces(batch.entries),
  }));

  const batchSizes = order.lines.map((line) => ({
    lineId: line.id,
    sizeCode: line.size.code,
    ordered: line.orderedQuantity,
    cut: line.cutQuantity,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Se regresa al pedido, no a la lista: si se entró desde la carpeta,
          mandar a la lista general obliga a volver a buscarla. */}
      <Link
        href={order.folder ? `/orders/folders/${order.folder.id}` : "/orders"}
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {order.folder ? order.folder.name : "Órdenes"}
      </Link>

      <PageHeader
        title={order.code}
        description={order.description ?? "Sin descripción"}
        action={
          !isCancelled ? (
            <div className="flex flex-wrap gap-2">
              {/* Va PRIMERO y es el único botón sólido: capturar el corte es
                  lo que se viene a hacer a esta pantalla; imprimir y editar
                  son lo de después. */}
              <OrderBatchDialog
                orderId={order.id}
                batches={batchOptions}
                sizes={batchSizes}
              />
              <Button asChild variant="outline" className="touch-target">
                <a href={`/print/order/${order.id}`} target="_blank" rel="noopener">
                  <Printer className="size-4" aria-hidden />
                  Imprimir
                </a>
              </Button>
              {/* La misma hoja que Imprimir, pero en Excel: es lo que se
                  manda por correo sin tener que escanear el papel. Va
                  `exact` porque los filtros de la lista no significan nada
                  dentro de una orden. */}
              <ExportButton
                href={`/api/export/orders/${order.id}`}
                label="Excel"
                exact
              />
              <Button asChild variant="outline" className="touch-target">
                <Link href={`/orders/${order.id}/edit`}>
                  <Pencil className="size-4" aria-hidden />
                  Editar
                </Link>
              </Button>
              {/* Junto a Editar porque es su hermana: una corrige esta orden
                  y la otra arranca una igual. El mismo cliente vuelve a pedir
                  la misma prenda con la misma base de tallas, y recapturar
                  quince renglones a mano es de donde salen los errores. */}
              <Button asChild variant="outline" className="touch-target">
                <Link href={`/orders/new?from=${order.id}`}>
                  <Copy className="size-4" aria-hidden />
                  Duplicar
                </Link>
              </Button>
              {/* Va antes de Mover y Cancelar: es la acción que sigue cuando
                  el taller termina, y estaba costando recapturar el desglose
                  entero en Salidas. */}
              {canSendToIssue && (
                <OrderSendToIssueDialog
                  orderId={order.id}
                  orderCode={order.code}
                  sizes={issueSizes}
                  pendingSizes={order.lines.length - issueSizes.length}
                  /* Este botón manda TODO lo cortado hasta hoy. Si ya hay una
                     salida en pie, lo que se cree ahora repite lo que ya se
                     llevó, así que el diálogo lo advierte antes de firmar. */
                  liveIssues={liveIssues.map((issue) => ({
                    code: issue.code,
                    isDraft: issue.status === "DRAFT",
                  }))}
                />
              )}
              {/* Sin talleres ni etapas dadas de alta no hay nada que
                  elegir, y el botón sólo llevaría a un diálogo vacío. */}
              {workshops.length > 0 && stages.length > 0 && (
                <OrderShipmentDialog
                  orderId={order.id}
                  orderCode={order.code}
                  sizes={shippableSizes}
                  workshops={workshops}
                  stages={stages}
                />
              )}
              <OrderMoveDialog
                orderId={order.id}
                orderCode={order.code}
                currentFolderId={order.folderId}
                folders={folders}
              />
              <OrderCancelDialog orderId={order.id} orderCode={order.code} />
            </div>
          ) : (
            /* Cancelada no se toca… salvo para volver a empezar. Duplicar es
               justo lo que se hace cuando una orden se cae: la base de tallas
               sigue siendo buena y lo único que sobra es su historial. */
            <Button asChild variant="outline" className="touch-target">
              <Link href={`/orders/new?from=${order.id}`}>
                <Copy className="size-4" aria-hidden />
                Duplicar
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded px-2 py-1 text-sm",
            CUTTING_ORDER_STATUS_STYLES[order.status],
          )}
        >
          {CUTTING_ORDER_STATUS_LABELS[order.status]}
        </span>
        <span className="tabular text-sm text-muted-foreground">
          {order.client?.name ?? "Sin cliente"}
          {order.material && ` · ${order.material.name}`}
        </span>

        {order.folder && (
          <Link
            href={`/orders/folders/${order.folder.id}`}
            className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-sm text-muted-foreground"
          >
            <FolderOpen className="size-3.5" aria-hidden />
            {order.folder.name}
          </Link>
        )}
      </div>

      {/* Los tres números que se buscan al abrir la orden. */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Pedidas" value={ordered} />
        <Stat label="Cortadas" value={cut} />
        {/* Rebasar el pedido no es un error: se cortó de más y hay que saber
            cuánto sobra, no ver un cero que oculta el excedente. */}
        {surplus > 0 ? (
          <Stat label="Sobran" value={surplus} tone="surplus" prefix="+" />
        ) : (
          <Stat label="Faltan" value={pending} tone="pending" />
        )}
      </div>

      {/* Los comentarios internos van ARRIBA de lo operativo: son la
          planeación —a qué taller va qué parte— y se leen antes de tocar
          nada, no después de recorrer la pantalla entera. */}
      <section className="flat-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Comentarios internos
          {commentViews.length > 0 && ` (${commentViews.length})`}
        </h2>
        <OrderComments
          orderId={order.id}
          comments={commentViews}
          canWrite={canComment}
        />
      </section>

      {/* Arriba del todo cuando la orden ya salió: es lo primero que hay que
          saber antes de mandar otro vale, no algo que se descubre al final de
          la pantalla. */}
      {issueViews.length > 0 && (
        <section className="flat-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">
            Salidas de esta orden
            {liveIssues.length > 0 && (
              <span className="ml-2 rounded bg-state-available px-1.5 py-0.5 text-xs font-medium text-state-available-foreground">
                {liveIssues.length === 1
                  ? "1 sin cancelar"
                  : `${liveIssues.length} sin cancelar`}
              </span>
            )}
          </h2>
          <OrderIssues issues={issueViews} />
        </section>
      )}

      {/* Va antes del desglose por talla sólo cuando hay algo afuera: lo que
          anda en un taller es lo que se pregunta por teléfono. */}
      {shipmentViews.length > 0 && (
        <section className="flat-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">En talleres</h2>
          <OrderShipments shipments={shipmentViews} />
        </section>
      )}

      <section className="flat-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Tallas</h2>

        <ul className="flex flex-col gap-2">
          {order.lines.map((line) => {
            const {
              pending: linePending,
              surplus: lineSurplus,
              done,
            } = cutProgress(line.orderedQuantity, line.cutQuantity);

            const stageCounts = [
              ...(balances.get(line.sizeId)?.byStage.values() ?? []),
            ];

            return (
              <li
                key={line.id}
                /* `items-start` y no `items-center`: con una anotación de
                   dos renglones, centrar dejaba el número de la derecha
                   flotando a media altura, lejos de su talla. */
                className="flat-surface flex items-start gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-sm font-medium">
                      Talla {line.size.code}
                    </span>
                    {line.cutTag && (
                      <span
                        className="px-1.5 py-0.5 text-xs"
                        style={{
                          backgroundColor: line.cutTag.color,
                          color: contrastText(line.cutTag.color),
                        }}
                      >
                        {line.cutTag.name}
                      </span>
                    )}
                  </div>

                  <p className="tabular text-xs text-muted-foreground">
                    {line.cutQuantity} de {line.orderedQuantity} cortadas
                    {linePending > 0 && ` · faltan ${linePending}`}
                    {lineSurplus > 0 && ` · sobran ${lineSurplus}`}
                  </p>

                  {/* A qué etapas ha salido esta talla. Una línea por etapa
                      y no un "disponible": lo que sale a bordar son paneles, y
                      la prenda sigue aquí para lo que falte. */}
                  {stageCounts.length > 0 && (
                    <p className="tabular text-xs text-muted-foreground">
                      {stageCounts
                        .map(
                          (stage) =>
                            `${stage.sent} a ${stage.stageName.toLowerCase()}`,
                        )
                        .join(" · ")}
                    </p>
                  )}

                  {/* La anotación de la talla, ENTERA y en su propio bloque.

                      Antes era otra línea gris diminuta con `truncate`, la
                      tercera seguida bajo el mismo estilo: se leía como más
                      relleno y "va sin bolsa" se cortaba a la mitad. Es una
                      instrucción para quien corta —el único texto libre que
                      lleva el renglón— y tiene que distinguirse de las cifras
                      que la rodean, no competir con ellas.

                      `whitespace-pre-wrap` porque la nota se teclea con sus
                      renglones y respetarlos es lo que la hace legible. */}
                  {line.notes && (
                    <p className="mt-1.5 flex items-start gap-1.5 border border-border bg-muted/40 px-2 py-1 text-sm">
                      <StickyNote
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="min-w-0 whitespace-pre-wrap break-words">
                        {line.notes}
                      </span>
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "tabular text-lg font-bold leading-none",
                      done && "text-state-available",
                      lineSurplus > 0 && "text-state-remnant",
                    )}
                  >
                    {lineSurplus > 0 ? `+${lineSurplus}` : linePending}
                  </p>
                </div>

                {/* Sin ningún corte abierto no hay a qué cargar las piezas:
                    el botón llevaría a un diálogo que no puede guardar. La
                    primera captura se hace con "Capturar corte". */}
                {!isCancelled && batchOptions.length > 0 && (
                  <OrderProgressDialog
                    lineId={line.id}
                    sizeCode={line.size.code}
                    ordered={line.orderedQuantity}
                    cut={line.cutQuantity}
                    batches={batchOptions}
                    trigger={
                      <Button
                        variant="outline"
                        size="icon"
                        className="touch-target shrink-0"
                        aria-label={`Registrar avance de la talla ${line.size.code}`}
                      >
                        <Plus className="size-4" aria-hidden />
                      </Button>
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* El encabezado del corte se muestra sólo si trae algo: en una orden
          que nunca lo llenó, una sección con cuatro renglones vacíos es ruido
          que estorba en la pantalla del celular. */}
      {hasCutHeader && (
        <section className="flat-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Encabezado del corte</h2>
          <dl className="grid gap-x-8 sm:grid-cols-2">
            <Row label="Tela (a mano)" value={order.cutFabricText} />
            <Row label="Molde" value={order.cutPattern} />
            <Row
              label="Versión"
              value={
                order.cutVersion ? CUT_VERSION_LABELS[order.cutVersion] : null
              }
            />
            <Row
              label="Descripción de la versión"
              value={order.cutVersionNotes}
            />
          </dl>

          {order.cutNotes.length > 0 && (
            <ol className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
              {order.cutNotes.map((note, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="tabular shrink-0 text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="min-w-0 break-words">{note}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <section className="flat-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Datos del pedido</h2>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          <Row label="Orden del cliente" value={order.reference} tabular />
          <Row label="Pedido el" value={formatDate(order.orderedAt)} tabular />
          <Row
            label="Entrega"
            value={order.dueDate ? formatDate(order.dueDate) : null}
            tabular
          />
          <Row
            label="Material"
            value={
              order.material
                ? `${order.material.code} · ${order.material.name}`
                : null
            }
          />
          <Row
            label="Producción"
            value={
              order.productionRun
                ? `${order.productionRun.code} · ${order.productionRun.name}`
                : null
            }
          />
          <Row label="Capturó" value={order.createdBy?.name} />
          <Row
            label="Terminada"
            value={order.closedAt ? formatDateTime(order.closedAt) : null}
            tabular
          />
        </dl>

        {order.notes && (
          <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm">
            {order.notes}
          </p>
        )}
      </section>

      {/* El historial, agrupado por tanda: un acumulado dice cuánto llevas,
          pero no cuántas dio el segundo corte, que es lo que se pregunta. */}
      <section className="flat-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Cortes ({batchViews.length})
        </h2>
        <OrderBatches
          batches={batchViews}
          orderId={order.id}
          orderCode={order.code}
          canSend={!isCancelled}
        />
      </section>
    </div>
  );
}

/** Ámbar mientras falte, violeta cuando sobre: el color dice el sentido. */
const STAT_TONES: Record<string, string> = {
  pending: "text-state-reserved",
  surplus: "text-state-remnant",
};

function Stat({
  label,
  value,
  tone,
  prefix,
}: {
  label: string;
  value: number;
  tone?: "pending" | "surplus";
  prefix?: string;
}) {
  return (
    <div className="flat-surface p-3 text-center">
      <p
        className={cn(
          "tabular text-2xl font-bold leading-none",
          tone && STAT_TONES[tone],
        )}
      >
        {prefix}
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({
  label,
  value,
  tabular,
}: {
  label: string;
  value: string | null | undefined;
  tabular?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1 text-sm last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words text-right", tabular && "tabular")}>
        {value}
      </dd>
    </div>
  );
}

/**
 * El nombre de piso del corte del que salió un vale ("1er corte").
 *
 * Sin corte devuelve nulo, y la pantalla lo lee como "orden completa": son
 * dos cosas distintas y confundirlas haría ver un vale de toda la orden como
 * si fuera de un tendido.
 */
function batchLabelOf(
  batches: { id: string; number: number; label: string | null }[],
  batchId: string | null,
): string | null {
  if (!batchId) return null;
  const batch = batches.find((item) => item.id === batchId);
  return batch ? cutBatchLabel(batch.number, batch.label) : null;
}
