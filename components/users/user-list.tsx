"use client";

import { UserCog } from "lucide-react";
import type { UserRow } from "@/lib/repositories/user.repository";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { USER_STATUS_LABELS, USER_STATUS_STYLES } from "@/lib/constants/labels";
import { userStatus } from "@/lib/constants/user-status";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { usePageParam } from "@/components/shared/use-page-param";
import { Badge } from "@/components/ui/badge";
import { UserActions } from "./user-actions";

interface Props {
  users: UserRow[];
  /** Quién está mirando. Su propia fila se marca y se le limita el menú. */
  currentUserId: string;
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  isFiltered?: boolean;
}

export function UserList({
  users,
  currentUserId,
  total,
  page,
  totalPages,
  pageSize,
  isFiltered,
}: Props) {
  const { onPageChange, onLoadMore, onPageSizeChange } = usePageParam();

  const columns: DataTableColumn<UserRow>[] = [
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{row.original.name}</span>
            {row.original.id === currentUserId && (
              <Badge variant="secondary" className="text-xs">
                Tú
              </Badge>
            )}
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {row.original.email}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Rol",
      cell: ({ row }) => (
        <Badge variant="outline">{ROLE_LABELS[row.original.role]}</Badge>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      enableSorting: false,
      cell: ({ row }) => <StatusBadge user={row.original} />,
    },
    {
      accessorKey: "phone",
      header: "Teléfono",
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {row.original.phone ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "sessionCount",
      header: "Sesiones",
      cell: ({ row }) => <SessionCell user={row.original} />,
    },
    {
      accessorKey: "createdAt",
      header: "Alta",
      cell: ({ row }) => (
        <span className="tabular text-xs text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-right">
          <UserActions user={row.original} currentUserId={currentUserId} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={users}
      server={{
        page,
        totalPages,
        total,
        pageSize,
        onPageChange,
        onLoadMore: () => onLoadMore(page),
        onPageSizeChange,
      }}
      itemLabel={{ one: "usuario", many: "usuarios" }}
      getRowId={(user) => user.id}
      emptyState={
        <div className="flat-surface">
          <EmptyState
            icon={UserCog}
            title={isFiltered ? "Sin resultados" : "Aún no hay usuarios"}
            description={
              isFiltered
                ? "Prueba con otro nombre, otro rol o quita el filtro de estado."
                : "Da de alta a quien va a capturar en el almacén."
            }
          />
        </div>
      }
      renderMobileRow={(user) => (
        <div className="flat-surface flex items-start gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{user.name}</span>
              {user.id === currentUserId && (
                <Badge variant="secondary" className="text-xs">
                  Tú
                </Badge>
              )}
              <StatusBadge user={user} />
            </div>

            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>

            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>{ROLE_LABELS[user.role]}</span>
              {user.phone && <span className="tabular">· {user.phone}</span>}
              {user.sessionCount > 0 && (
                <span className="tabular">
                  ·{" "}
                  {user.sessionCount === 1
                    ? "1 sesión abierta"
                    : `${user.sessionCount} sesiones abiertas`}
                </span>
              )}
            </p>
          </div>

          <UserActions user={user} currentUserId={currentUserId} />
        </div>
      )}
    />
  );
}

function StatusBadge({ user }: { user: UserRow }) {
  const status = userStatus(user);

  return (
    <Badge
      variant="outline"
      className={cn("border-transparent text-xs", USER_STATUS_STYLES[status])}
      title={user.banReason ?? undefined}
    >
      {USER_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Sesiones abiertas y última señal de vida.
 *
 * Es lo que contesta "¿ya se fue a su casa o sigue capturando?" antes de
 * suspender a alguien a media jornada.
 */
function SessionCell({ user }: { user: UserRow }) {
  if (user.sessionCount === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col">
      <span className="tabular text-sm font-medium">{user.sessionCount}</span>
      {user.lastSeenAt && (
        <span className="tabular text-xs text-muted-foreground">
          {formatDateTime(user.lastSeenAt)}
        </span>
      )}
    </div>
  );
}
