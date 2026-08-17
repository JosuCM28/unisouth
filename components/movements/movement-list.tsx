import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, History } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MovementDirection, Unit } from "@prisma/client";
import type { MovementWithRelations } from "@/lib/repositories/movement.repository";
import { MOVEMENT_TYPE_LABELS, UNIT_SHORT_LABELS } from "@/lib/constants/labels";
import { cn, formatDateTime, formatQuantity, type PlainObject } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * El movimiento ya sin los `Decimal` de Prisma.
 *
 * La página lo pasa por `toPlainObject()` antes de entregarlo: un `Decimal`
 * no es serializable y revienta al cruzar al cliente.
 */
type PlainMovement = PlainObject<MovementWithRelations>;

interface DirectionStyle {
  icon: LucideIcon;
  className: string;
  sign: string;
}

/**
 * Cómo se pinta cada dirección.
 *
 * Se indexa por `direction` y no por el signo de la cantidad: un traspaso
 * mueve el rollo de fila con cantidad 0, y mirando sólo el signo se vería
 * igual que un movimiento sin efecto.
 */
const DIRECTION_STYLES: Record<MovementDirection, DirectionStyle> = {
  IN: { icon: ArrowDownLeft, className: "text-state-available", sign: "+" },
  OUT: { icon: ArrowUpRight, className: "text-state-defective", sign: "−" },
  NEUTRAL: {
    icon: ArrowLeftRight,
    className: "text-muted-foreground",
    sign: "",
  },
};

interface Props {
  movements: PlainMovement[];
}

/**
 * El kárdex, movimiento por movimiento.
 *
 * Server Component: es una lista de sólo lectura, sin estado ni eventos. Los
 * filtros son los únicos que necesitan cliente, y viven aparte.
 *
 * En celular van tarjetas apiladas y la tabla aparece hasta `md:`: una tabla
 * de ocho columnas con scroll horizontal es ilegible con una mano.
 */
export function MovementList({ movements }: Props) {
  if (movements.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={History}
          title="Sin movimientos"
          description="No hay entradas ni salidas que coincidan con los filtros."
        />
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {movements.map((movement) => (
          <MovementCard key={movement.id} movement={movement} />
        ))}
      </ul>

      <div className="hidden md:block">
        <MovementTable movements={movements} />
      </div>
    </>
  );
}

function MovementCard({ movement }: { movement: PlainMovement }) {
  const style = DIRECTION_STYLES[movement.direction];
  const Icon = style.icon;
  const unitLabel = UNIT_SHORT_LABELS[movement.unit as Unit] ?? movement.unit;
  const quantity = Math.abs(Number(movement.quantity));

  return (
    <li className="flat-surface flex items-start gap-3 p-3">
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.className)} aria-hidden />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {MOVEMENT_TYPE_LABELS[movement.type]}
        </p>

        <p className="truncate text-xs text-muted-foreground">
          <Link
            href={`/lots/${movement.lot.code}`}
            className="tabular underline-offset-2 hover:underline"
          >
            {movement.lot.code}
          </Link>{" "}
          · {movement.material.name}
          {movement.lot.shade && ` · tono ${movement.lot.shade}`}
        </p>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDateTime(movement.createdAt)}
          {movement.userName && ` · ${movement.userName}`}
        </p>

        {movement.reason && (
          <p className="mt-1 text-xs text-muted-foreground">
            {movement.reason}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <span className={cn("tabular text-sm font-medium", style.className)}>
          {style.sign}
          {formatQuantity(quantity, { unit: unitLabel })}
        </span>
        <p className="tabular text-xs text-muted-foreground">
          Queda {formatQuantity(movement.balanceAfter, { unit: unitLabel })}
        </p>
      </div>
    </li>
  );
}

function MovementTable({ movements }: Props) {
  return (
    <div className="flat-surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <Th>Fecha</Th>
            <Th>Folio</Th>
            <Th>Movimiento</Th>
            <Th>Rollo</Th>
            <Th>Material</Th>
            <Th className="text-right">Cantidad</Th>
            <Th className="text-right">Saldo</Th>
            <Th>Documento</Th>
            <Th>Quién</Th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {movements.map((movement) => (
            <MovementRow key={movement.id} movement={movement} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MovementRow({ movement }: { movement: PlainMovement }) {
  const style = DIRECTION_STYLES[movement.direction];
  const unitLabel = UNIT_SHORT_LABELS[movement.unit as Unit] ?? movement.unit;
  const quantity = Math.abs(Number(movement.quantity));

  return (
    <tr className="transition-colors hover:bg-accent">
      <Td className="tabular whitespace-nowrap text-xs text-muted-foreground">
        {formatDateTime(movement.createdAt)}
      </Td>

      <Td className="tabular whitespace-nowrap text-xs">{movement.code}</Td>

      <Td className="whitespace-nowrap">
        <span className={cn("text-xs font-medium", style.className)}>
          {MOVEMENT_TYPE_LABELS[movement.type]}
        </span>
      </Td>

      <Td className="whitespace-nowrap">
        <Link
          href={`/lots/${movement.lot.code}`}
          className="tabular text-xs underline-offset-2 hover:underline"
        >
          {movement.lot.code}
        </Link>
      </Td>

      <Td className="max-w-[16rem] truncate text-xs">
        {movement.material.name}
      </Td>

      <Td className={cn("tabular whitespace-nowrap text-right", style.className)}>
        {style.sign}
        {formatQuantity(quantity, { unit: unitLabel })}
      </Td>

      <Td className="tabular whitespace-nowrap text-right text-xs text-muted-foreground">
        {formatQuantity(movement.balanceAfter, { unit: unitLabel })}
      </Td>

      <Td className="whitespace-nowrap text-xs">
        {movement.document ? (
          <Link
            href={`/documents/${movement.document.id}`}
            className="tabular underline-offset-2 hover:underline"
          >
            {movement.document.code}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </Td>

      <Td className="max-w-[10rem] truncate text-xs text-muted-foreground">
        {movement.userName ?? "—"}
      </Td>
    </tr>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-3 py-2", className)}>{children}</td>;
}
