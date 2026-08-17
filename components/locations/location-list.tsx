import { MapPin } from "lucide-react";
import type { Location } from "@prisma/client";
import { LOCATION_TYPE_LABELS } from "@/lib/constants/labels";
import type { LocationWithLotCount } from "@/lib/repositories/location.repository";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LocationActions } from "./location-actions";

interface LocationListProps {
  locations: LocationWithLotCount[];
  parents: Pick<Location, "id" | "code" | "name">[];
  /** Para distinguir "no hay nada" de "la búsqueda no encontró nada". */
  isFiltered?: boolean;
}

/**
 * SERVER Component: no necesita estado ni eventos. Sólo el menú de acciones
 * de cada fila es cliente, y va aislado en su propio archivo.
 */
export function LocationList({
  locations,
  parents,
  isFiltered,
}: LocationListProps) {
  if (locations.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={MapPin}
          title={isFiltered ? "Sin resultados" : "Aún no hay ubicaciones"}
          description={
            isFiltered
              ? "Prueba con otro código o nombre."
              : "Da de alta la primera fila o rack de la bodega."
          }
        />
      </div>
    );
  }

  return (
    <>
      {/* En celular, tarjetas apiladas: una tabla obligaría a barrer de lado
          para leer una fila, con el teléfono en una mano. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {locations.map((location) => (
          <li key={location.id} className="flat-surface flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="tabular font-medium">{location.code}</span>
                {!location.active && (
                  <Badge variant="secondary" className="text-xs">
                    Inactiva
                  </Badge>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {location.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {LOCATION_TYPE_LABELS[location.type]} ·{" "}
                <span className="tabular">{location.lotCount}</span>{" "}
                {location.lotCount === 1 ? "rollo" : "rollos"}
              </p>
            </div>

            <LocationActions location={location} parents={parents} />
          </li>
        ))}
      </ul>

      {/* Desde md sí cabe la tabla y se comparan filas de un vistazo. */}
      <div className="hidden md:block">
        <div className="flat-surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-36">Tipo</TableHead>
                <TableHead className="w-24 text-right">Rollos</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="tabular font-medium">
                    <div className="flex items-center gap-2">
                      {location.code}
                      {!location.active && (
                        <Badge variant="secondary" className="text-xs">
                          Inactiva
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{location.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {LOCATION_TYPE_LABELS[location.type]}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {location.lotCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <LocationActions location={location} parents={parents} />
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
