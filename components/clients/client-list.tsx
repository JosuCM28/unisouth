import { Users } from "lucide-react";
import type { ClientWithLotCount } from "@/lib/repositories/client.repository";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClientActions } from "./client-actions";

interface Props {
  clients: ClientWithLotCount[];
  isFiltered?: boolean;
}

export function ClientList({ clients, isFiltered }: Props) {
  if (clients.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={Users}
          title={isFiltered ? "Sin resultados" : "Aún no hay clientes"}
          description={
            isFiltered
              ? "Prueba con otro nombre o código."
              : "Da de alta al primer cliente dueño de material."
          }
        />
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {clients.map((client) => (
          <li key={client.id} className="flat-surface flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{client.name}</span>
                {!client.active && (
                  <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                )}
              </div>
              {client.contact && (
                <p className="truncate text-sm text-muted-foreground">{client.contact}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="tabular">{client.lotCount}</span>{" "}
                {client.lotCount === 1 ? "rollo" : "rollos"} en bodega
              </p>
            </div>
            <ClientActions client={client} />
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <div className="flat-surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="w-24 text-right">Rollos</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {client.name}
                      {!client.active && (
                        <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">{client.code ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{client.contact ?? "—"}</TableCell>
                  <TableCell className="tabular text-right">{client.lotCount}</TableCell>
                  <TableCell className="text-right"><ClientActions client={client} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
