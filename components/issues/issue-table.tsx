"use client";

import Link from "next/link";
import { PackageMinus, Scissors, Send } from "lucide-react";
import type { Unit } from "@prisma/client";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_STYLES,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { cn, formatDate, formatQuantity } from "@/lib/utils";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { usePageParam } from "@/components/shared/use-page-param";
import { IssueCard, type IssueRow } from "./issue-card";

/** Una salida en la tabla: lo mismo que pinta la tarjeta del celular. */
export type IssueTableRow = IssueRow;

/** La página que sirvió Postgres. */
interface ServerPage {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

interface Props {
  issues: IssueTableRow[];
  server: ServerPage;
  /** Cambia el texto del vacío: "no hay" no es lo mismo que "no coincide". */
  isFiltered?: boolean;
}

/**
 * El registro de salidas en tabla.
 *
 * Desde `md:` es una tabla y en celular siguen siendo tarjetas —eso lo
 * resuelve `DataTable`, no esta pantalla—. La razón es de piso: en el
 * escritorio se COMPARAN vales ("¿cuál salió primero?", "¿cuánto se llevó
 * Ternium este mes?", "¿qué anda en el taller?"), y para comparar hacen falta
 * columnas alineadas. En el celular no se compara: se busca UN vale y se abre.
 *
 * El FILTRADO no lo hace TanStack, lo hace Postgres a través de la URL. La
 * tabla sólo tiene en la mano las 50 filas de esta página, así que un filtro
 * resuelto aquí escondería las salidas que están en la página 3 y diría que no
 * existen. El buscador y los chips de arriba filtran sobre el total. De
 * TanStack se usa lo que sí puede resolver con lo que tiene: ordenar por
 * columna y gobernar la paginación.
 */
export function IssueTable({ issues, server, isFiltered = false }: Props) {
  const { onPageChange, onLoadMore, onPageSizeChange } = usePageParam();

  const columns: DataTableColumn<IssueTableRow>[] = [
    {
      accessorKey: "code",
      header: "Folio",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/documents/${row.original.id}`}
            className="tabular font-medium hover:underline"
          >
            {row.original.code}
          </Link>
          {/* La marca va pegada al folio y no en su propia columna: se recorre
              la lista por esta orilla, y un vale de maquila tiene que
              distinguirse sin leer hasta la mitad de la fila. */}
          {row.original.shipment && (
            <span className="flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              <Send className="size-3" aria-hidden />A taller
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs",
            DOCUMENT_STATUS_STYLES[row.original.status],
          )}
        >
          {DOCUMENT_STATUS_LABELS[row.original.status]}
        </span>
      ),
    },
    {
      id: "date",
      header: "Fecha",
      // Se ordena por el instante real y no por el texto ya formateado: "03
      // sep" y "3 ene" alfabéticamente quedan al revés de como ocurrieron.
      accessorFn: (issue) => new Date(issue.date).getTime(),
      cell: ({ row }) => (
        <span className="tabular">{formatDate(row.original.date)}</span>
      ),
    },
    {
      id: "concept",
      header: "Concepto",
      accessorFn: (issue) => issue.concept ?? issue.cutDescription ?? "",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.concept ?? row.original.cutDescription ?? "—"}
        </span>
      ),
    },
    {
      id: "material",
      header: "Tela",
      accessorFn: (issue) => materialOf(issue),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {materialOf(row.original) || "—"}
        </span>
      ),
    },
    {
      id: "client",
      header: "Cliente",
      accessorFn: (issue) => issue.clientName ?? "",
      cell: ({ row }) => (
        <span>{row.original.clientName ?? "Sin cliente"}</span>
      ),
    },
    {
      id: "receivedBy",
      header: "Recibió",
      accessorFn: (issue) => issue.receivedBy ?? "",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.receivedBy ?? "—"}
        </span>
      ),
    },
    {
      id: "shipment",
      header: "Envío a taller",
      /* Ordena por etapa y taller juntos: picar el encabezado agrupa lo de
         BORDADO por un lado y lo de ARMADO por otro, que es como se revisa
         qué está afuera. Las salidas normales van al final, con cadena
         vacía. */
      accessorFn: (issue) => shipmentSortKey(issue),
      cell: ({ row }) => <Shipment issue={row.original} />,
    },
    {
      id: "reference",
      header: "Ref.",
      accessorFn: (issue) => issue.reference ?? "",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {row.original.reference ?? "—"}
        </span>
      ),
    },
    {
      id: "quantity",
      header: "Cantidad",
      accessorFn: (issue) => issue.summary.totalQuantity,
      cell: ({ row }) => <Quantity issue={row.original} />,
    },
    {
      id: "lots",
      header: "Rollos",
      accessorFn: (issue) => issue.summary.lots,
      cell: ({ row }) => (
        <span className="tabular">{row.original.summary.lots || "—"}</span>
      ),
    },
    {
      id: "pieces",
      header: "Prendas",
      accessorFn: (issue) => issue.summary.cutPieces,
      cell: ({ row }) => <Pieces pieces={row.original.summary.cutPieces} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={issues}
      getRowId={(issue) => issue.id}
      itemLabel={{ one: "salida", many: "salidas" }}
      server={{
        ...server,
        onPageChange,
        onLoadMore: () => onLoadMore(server.page),
        onPageSizeChange,
      }}
      emptyState={
        <div className="flat-surface">
          <EmptyState
            icon={PackageMinus}
            title={isFiltered ? "Ninguna salida coincide" : "Aún no hay salidas"}
            description={
              isFiltered
                ? "Prueba con menos palabras o quita el filtro de estado."
                : "Registra la primera cuando producción se lleve material."
            }
          />
        </div>
      }
      renderMobileRow={(issue) => <IssueCard issue={issue} />}
    />
  );
}

/**
 * La tela del vale.
 *
 * La de los rollos manda, y si no llevó rollos —al taller salen prendas ya
 * cortadas— vale la del desglose de corte, que es lo único que dice de qué
 * está hecho lo que salió.
 */
function materialOf(issue: IssueTableRow): string {
  if (issue.summary.materialNames.length > 0) {
    return issue.summary.materialNames.join(" · ");
  }

  return issue.cutFabricName ?? "";
}

/** Etapa y taller juntos, para poder ordenar por ellos. */
function shipmentSortKey(issue: IssueTableRow): string {
  if (!issue.shipment) return "";

  return `${issue.shipment.stageName} ${issue.shipment.workshopName}`;
}

/**
 * A qué taller y a qué etapa salió, con el folio del envío.
 *
 * Las dos cosas en la misma celda y en dos renglones: son el mismo dato —"esto
 * anda en SITEX para bordado, con el vale ENV-2026-0009"— y separarlas en dos
 * columnas gastaría ancho para que el ojo tuviera que volver a juntarlas.
 */
function Shipment({ issue }: { issue: IssueTableRow }) {
  if (!issue.shipment) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-col">
      <span className="truncate">
        {issue.shipment.stageName} · {issue.shipment.workshopName}
      </span>
      <span className="tabular text-xs text-muted-foreground">
        {issue.shipment.code}
      </span>
    </div>
  );
}

/**
 * El metraje que se llevó.
 *
 * Un vale sin rollos no lleva cero metros: no lleva metros. El guión lo dice
 * sin que nadie tenga que interpretarlo, que es lo que pasaría con un 0.00.
 */
function Quantity({ issue }: { issue: IssueTableRow }) {
  const { totalQuantity, unit } = issue.summary;

  if (totalQuantity === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const unitLabel = unit ? UNIT_SHORT_LABELS[unit as Unit] : "";

  return (
    <span className="tabular font-medium">
      {formatQuantity(totalQuantity, { unit: unitLabel })}
    </span>
  );
}

/** Las prendas del desglose de corte: cantidad × bultos, ya sumadas. */
function Pieces({ pieces }: { pieces: number }) {
  if (pieces === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <span className="tabular flex items-center gap-1 font-medium">
      <Scissors className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      {formatQuantity(pieces)}
    </span>
  );
}
