import Link from "next/link";
import { UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { formatDate, formatQuantity } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusChip, type LotCardData } from "./lot-card";

/** Versión de escritorio: sólo aparece desde md:, donde sí cabe comparar filas. */
export function LotTable({ lots }: { lots: LotCardData[] }) {
  return (
    <div className="hidden md:block">
      <div className="flat-surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Folio</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="w-24">Tono</TableHead>
              <TableHead className="w-28">Ubicación</TableHead>
              <TableHead className="w-36">Cliente</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-32 text-right">Cantidad</TableHead>
              <TableHead className="w-28">Recibido</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {lots.map((lot) => (
              <TableRow key={lot.id}>
                <TableCell className="tabular font-medium">
                  <Link href={`/lots/${lot.code}`} className="hover:underline">
                    {lot.code}
                  </Link>
                </TableCell>
                <TableCell>
                  {lot.material.name}
                  {lot.colorText && (
                    <span className="text-muted-foreground"> · {lot.colorText}</span>
                  )}
                </TableCell>
                <TableCell className="tabular text-muted-foreground">
                  {lot.shade ?? "—"}
                </TableCell>
                <TableCell className="tabular text-muted-foreground">
                  {lot.location?.code ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lot.client?.name ?? "Fábrica"}
                </TableCell>
                <TableCell><StatusChip status={lot.status} /></TableCell>
                <TableCell className="tabular text-right font-medium">
                  {formatQuantity(lot.currentQuantity, {
                    unit: UNIT_SHORT_LABELS[lot.unit],
                  })}
                </TableCell>
                <TableCell className="tabular text-muted-foreground">
                  {formatDate(lot.receivedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
