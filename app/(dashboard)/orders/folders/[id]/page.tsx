import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Pencil, Plus } from "lucide-react";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { OrderFolderRepository } from "@/lib/repositories/order-folder.repository";
import { prisma } from "@/lib/prisma";
import { cutBatchLabel } from "@/lib/constants/labels";
import { buildFolderSendPreview } from "@/lib/folder-send-preview";
import { cutProgress, formatDate, toDateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ExportButton } from "@/components/shared/export-button";
import { Button } from "@/components/ui/button";
import { FolderArchiveButton } from "@/components/orders/folder-archive-button";
import { FolderDeleteButton } from "@/components/orders/folder-delete-button";
import { FolderSendToIssueDialog } from "@/components/orders/folder-send-to-issue-dialog";
import { FolderWorkshopDialog } from "@/components/orders/folder-workshop-dialog";
import { OrderTable } from "@/components/orders/order-table";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const folder = await prisma.orderFolder.findUnique({
    where: { id },
    select: { code: true, name: true },
  });
  return { title: folder ? `${folder.code} · ${folder.name}` : "Pedido" };
}

/**
 * Ficha de un pedido: sus órdenes y cómo va el conjunto.
 *
 * Responde la pregunta que el cliente hace por teléfono —"¿cómo va mi
 * pedido?"— sin tener que abrir orden por orden y sumar a mano.
 */
export default async function OrderFolderPage({ params }: PageProps) {
  const user = await requirePermission("orders:browse");
  /* La ficha del pedido contesta "¿cómo va?", y eso se puede contestar sin
     poder tocarlo: quien no captura la lee entera —totales, órdenes, avance—
     pero sin editar, archivar ni borrar. */
  const canWrite = roleHasPermission(user.role, "inventory:write");

  const { id } = await params;

  const repository = new OrderFolderRepository();

  const folder = await repository.findWithOrders(id);
  if (!folder) notFound();

  /* El resumen de lo que saldría del pedido. Sólo se calcula para quien puede
     capturar: a quien nada más consulta no se le pintan esos botones, y
     recorrer los cortes de todas las órdenes para no enseñar nada sería un
     viaje de más en la pantalla que más se abre. */
  const send = canWrite
    ? await buildSendContext(repository, id)
    : null;

  const totals = folder.orders
    .filter((order) => order.status !== "CANCELLED")
    .reduce(
      (sum, order) => {
        for (const line of order.lines) {
          sum.ordered += line.orderedQuantity;
          sum.cut += line.cutQuantity;
        }
        return sum;
      },
      { ordered: 0, cut: 0 },
    );

  const { pending, surplus } = cutProgress(totals.ordered, totals.cut);
  const isArchived = Boolean(folder.archivedAt);

  /* El alta de orden entra con el pedido, el cliente y la entrega ya puestos:
     dentro de una carpeta esos tres datos ya se conocen y volver a pedirlos
     es la clase de fricción que hace que nadie use el sistema. */
  const newOrderHref = buildNewOrderHref(folder);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/orders"
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Órdenes
      </Link>

      <PageHeader
        title={folder.name}
        description={`${folder.code}${folder.client ? ` · ${folder.client.name}` : ""}`}
        action={
          canWrite &&
          !isArchived && (
            <Button asChild className="touch-target">
              <Link href={newOrderHref}>
                <Plus className="size-4" aria-hidden />
                Nueva orden
              </Link>
            </Button>
          )
        }
      />

      <div className="flat-surface flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Total label="Pedidas" value={totals.ordered} />
          <Total label="Cortadas" value={totals.cut} />
          <Total
            label={surplus > 0 ? "Sobran" : "Faltan"}
            value={surplus > 0 ? surplus : pending}
            highlight={surplus > 0}
          />
          <Total
            label={folder.orders.length === 1 ? "Orden" : "Órdenes"}
            value={folder.orders.length}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* El concentrado lo baja cualquiera que pueda abrir el pedido: es
              la hoja que se manda por correo cuando el cliente pregunta, y
              quien contesta el teléfono no captura nada. `exact` porque los
              filtros de la lista no significan nada dentro de un pedido. */}
          <ExportButton
            href={`/api/export/folders/${folder.id}`}
            label="Total a cortar"
            exact
          />

          {send && !isArchived && (
            <>
              <FolderSendToIssueDialog
                folderId={folder.id}
                folderCode={folder.code}
                sizes={send.preview.issue.sizes}
                pieces={send.preview.issue.pieces}
                bundles={send.preview.issue.bundles}
                orders={send.preview.issue.orders}
                skipped={send.preview.issue.skipped}
                clients={send.preview.clients}
              />

              {/* Sin talleres o sin etapas capturadas el diálogo no tendría
                  qué ofrecer, y un botón que abre un formulario imposible de
                  llenar sólo se aprieta una vez. */}
              {send.workshops.length > 0 && send.stages.length > 0 && (
                <FolderWorkshopDialog
                  folderId={folder.id}
                  folderCode={folder.code}
                  sizes={send.preview.workshop.sizes}
                  pieces={send.preview.workshop.pieces}
                  bundles={send.preview.workshop.bundles}
                  orders={send.preview.workshop.orders}
                  skippedOrders={send.preview.workshop.skippedOrders}
                  workshops={send.workshops}
                  stages={send.stages}
                />
              )}
            </>
          )}

          {canWrite && (
            <>
            <Button asChild variant="outline" className="touch-target">
              <Link href={`/orders/folders/${folder.id}/edit`}>
                <Pencil className="size-4" aria-hidden />
                Editar
              </Link>
            </Button>
            <FolderArchiveButton folderId={folder.id} isArchived={isArchived} />
            {/* Aquí es donde se vacía el pedido —orden por orden, abajo— así
                que aquí tiene que estar el botón que se desbloquea al
                terminar. */}
            <FolderDeleteButton
              folderId={folder.id}
              folderCode={folder.code}
              orderCount={folder.orders.length}
            />
            </>
          )}
        </div>
      </div>

      {(folder.reference || folder.dueDate || folder.notes) && (
        <div className="flat-surface flex flex-col gap-2 p-4 text-sm">
          {folder.reference && (
            <p>
              <span className="text-muted-foreground">Orden del cliente: </span>
              <span className="tabular">{folder.reference}</span>
            </p>
          )}
          {folder.dueDate && (
            <p>
              <span className="text-muted-foreground">Entrega: </span>
              <span className="tabular">{formatDate(folder.dueDate)}</span>
            </p>
          )}
          {folder.notes && (
            <p className="whitespace-pre-wrap text-muted-foreground">
              {folder.notes}
            </p>
          )}
        </div>
      )}

      {folder.orders.length === 0 ? (
        <div className="flat-surface">
          <EmptyState
            icon={ClipboardList}
            title="Este pedido no tiene órdenes"
            description={
              canWrite
                ? "Agrega la primera orden de corte del pedido."
                : "Cuando se den de alta, aparecerán aquí."
            }
            action={
              canWrite &&
              !isArchived && (
                <Button asChild className="touch-target">
                  <Link href={newOrderHref}>
                    <Plus className="size-4" aria-hidden />
                    Nueva orden
                  </Link>
                </Button>
              )
            }
          />
        </div>
      ) : (
        /* En tabla desde `md:`, igual que la lista general: aquí se comparan
           las órdenes del pedido entre sí —cuál va más atrasada, cuál vence
           antes— y para comparar hacen falta columnas alineadas.

           Sin `server`: las órdenes del pedido llegan TODAS en la consulta de
           arriba, así que la página la reparte el navegador. Pedirle a
           Postgres que recorte una docena de filas sería un viaje de más.

           Sin columna de pedido: todas son de éste. */
        <OrderTable
          orders={folder.orders.map((order) => ({
            ...order,
            folderName: null,
          }))}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}

/**
 * Lo que necesitan los dos botones de "mandar el pedido entero".
 *
 * Los cortes, los talleres y las etapas van en una sola ida a la base: son
 * tres consultas independientes y encadenarlas sumaría tres viajes a la
 * pantalla que más se abre del módulo.
 *
 * El resumen se calcula con la MISMA función que después arma los renglones,
 * así que lo que el diálogo enseña y lo que el vale acaba llevando no pueden
 * diferir.
 */
async function buildSendContext(
  repository: OrderFolderRepository,
  folderId: string,
) {
  const [orders, workshops, stages] = await Promise.all([
    repository.findSendableCuts(folderId),
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
  ]);

  return {
    preview: buildFolderSendPreview(orders, cutBatchLabel),
    workshops,
    stages,
  };
}

/** Un número grande con su etiqueta. Los totales del pedido de un vistazo. */
function Total({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <p
        className={
          highlight
            ? "tabular text-lg font-bold leading-none text-state-remnant"
            : "tabular text-lg font-bold leading-none"
        }
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Enlace al alta de orden con lo que ya se sabe del pedido precargado. */
function buildNewOrderHref(folder: {
  id: string;
  clientId: string | null;
  dueDate: Date | null;
}): string {
  const params = new URLSearchParams({ folder: folder.id });
  if (folder.clientId) params.set("client", folder.clientId);
  if (folder.dueDate) params.set("due", toDateInputValue(folder.dueDate));
  return `/orders/new?${params.toString()}`;
}
