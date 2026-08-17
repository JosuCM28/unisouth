import { AlertTriangle, Package } from "lucide-react";
import type { Material } from "@prisma/client";
import {
  MATERIAL_TYPE_LABELS,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import { formatFabricSpec } from "@/lib/material-spec";
import { cn, formatQuantity, type PlainObject } from "@/lib/utils";
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
import { MaterialActions } from "./material-actions";

/** Material con los Decimal ya convertidos: es lo que puede cruzar al cliente. */
type PlainMaterial = PlainObject<Material>;

interface MaterialListProps {
  materials: PlainMaterial[];
  /** Existencia disponible por material, resuelta con groupBy en la base. */
  stock: Map<string, number>;
  isFiltered?: boolean;
}

export function MaterialList({
  materials,
  stock,
  isFiltered,
}: MaterialListProps) {
  if (materials.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={Package}
          title={isFiltered ? "Sin resultados" : "Aún no hay materiales"}
          description={
            isFiltered
              ? "Prueba con otro código, nombre o color."
              : "Da de alta la primera tela o insumo."
          }
        />
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {materials.map((material) => {
          const available = stock.get(material.id) ?? 0;
          const isLow = isBelowReorder(material, available);

          return (
            <li
              key={material.id}
              className="flat-surface flex items-start gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="tabular text-sm font-medium">
                    {material.code}
                  </span>
                  {!material.active && (
                    <Badge variant="secondary" className="text-xs">
                      Inactivo
                    </Badge>
                  )}
                </div>

                <p className="truncate text-sm">{material.name}</p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {MATERIAL_TYPE_LABELS[material.type]}
                  <MaterialSpec material={material} />
                </p>

                <StockLine
                  available={available}
                  unit={UNIT_SHORT_LABELS[material.baseUnit]}
                  isLow={isLow}
                  reorderPoint={Number(material.reorderPoint)}
                />
              </div>

              <MaterialActions material={material} />
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block">
        <div className="flat-surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead className="w-24">Especif.</TableHead>
                <TableHead className="w-36 text-right">Existencia</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {materials.map((material) => {
                const available = stock.get(material.id) ?? 0;
                const isLow = isBelowReorder(material, available);

                return (
                  <TableRow key={material.id}>
                    <TableCell className="tabular font-medium">
                      <div className="flex items-center gap-2">
                        {material.code}
                        {!material.active && (
                          <Badge variant="secondary" className="text-xs">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{material.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {MATERIAL_TYPE_LABELS[material.type]}
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {formatFabricSpec(material) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isLow && (
                          <AlertTriangle
                            className="size-3.5 text-state-reserved"
                            aria-label="Bajo el punto de reorden"
                          />
                        )}
                        <span
                          className={cn(
                            "tabular",
                            isLow && "font-medium text-state-reserved",
                          )}
                        >
                          {formatQuantity(available, {
                            unit: UNIT_SHORT_LABELS[material.baseUnit],
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <MaterialActions material={material} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}

/** El grosor se muestra en la unidad que esté capturada: oz o mm. */
function MaterialSpec({ material }: { material: PlainMaterial }) {
  const spec = formatFabricSpec(material);
  if (!spec) return null;

  return (
    <>
      {" · "}
      <span className="tabular">{spec}</span>
    </>
  );
}

function StockLine({
  available,
  unit,
  isLow,
  reorderPoint,
}: {
  available: number;
  unit: string;
  isLow: boolean;
  reorderPoint: number;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      {isLow && (
        <AlertTriangle
          className="size-3.5 shrink-0 text-state-reserved"
          aria-hidden
        />
      )}
      <span
        className={cn(
          "tabular text-sm",
          isLow ? "font-medium text-state-reserved" : "text-muted-foreground",
        )}
      >
        {formatQuantity(available, { unit })}
      </span>
      {isLow && (
        <span className="text-xs text-muted-foreground">
          (reorden <span className="tabular">{formatQuantity(reorderPoint)}</span>)
        </span>
      )}
    </div>
  );
}

/**
 * Bajo el punto de reorden = hay que comprar.
 *
 * Un punto de reorden en cero significa "no se controla", no "siempre falta":
 * sin esa guarda, todo material sin configurar saldría en rojo.
 */
function isBelowReorder(material: PlainMaterial, available: number): boolean {
  const reorderPoint = Number(material.reorderPoint);
  if (reorderPoint <= 0) return false;
  return available < reorderPoint;
}
