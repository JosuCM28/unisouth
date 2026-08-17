import { Factory } from "lucide-react";
import { PRODUCTION_RUN_STATUS_LABELS, PRODUCTION_RUN_STATUS_STYLES } from "@/lib/constants/labels";
import type { ProductionRunWithDetail } from "@/lib/repositories/production-run.repository";
import { cn, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ProductionRunActions } from "./production-run-actions";

interface Props {
  runs: ProductionRunWithDetail[];
  clients: { id: string; name: string }[];
  isFiltered?: boolean;
}

export function ProductionRunList({ runs, clients, isFiltered }: Props) {
  if (runs.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={Factory}
          title={isFiltered ? "Sin resultados" : "Aún no hay producciones"}
          description={
            isFiltered
              ? "Prueba con otro código, nombre o cliente."
              : "Crea la primera corrida de producción."
          }
        />
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {runs.map((run) => (
          <li key={run.id} className="flat-surface flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular text-sm font-medium">{run.code}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-xs", PRODUCTION_RUN_STATUS_STYLES[run.status])}>
                  {PRODUCTION_RUN_STATUS_LABELS[run.status]}
                </span>
              </div>
              <p className="truncate text-sm">{run.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {run.clientName} · <span className="tabular">{run.lotCount}</span>{" "}
                {run.lotCount === 1 ? "rollo" : "rollos"}
              </p>
            </div>
            <ProductionRunActions run={run} clients={clients} />
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <div className="flat-surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-40">Cliente</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead className="w-28">Inicio</TableHead>
                <TableHead className="w-20 text-right">Rollos</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="tabular font-medium">{run.code}</TableCell>
                  <TableCell>{run.name}</TableCell>
                  <TableCell className="text-muted-foreground">{run.clientName}</TableCell>
                  <TableCell>
                    <span className={cn("rounded px-1.5 py-0.5 text-xs", PRODUCTION_RUN_STATUS_STYLES[run.status])}>
                      {PRODUCTION_RUN_STATUS_LABELS[run.status]}
                    </span>
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">{formatDate(run.startDate)}</TableCell>
                  <TableCell className="tabular text-right">{run.lotCount}</TableCell>
                  <TableCell className="text-right">
                    <ProductionRunActions run={run} clients={clients} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
