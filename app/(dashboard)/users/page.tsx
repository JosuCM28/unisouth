import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { UserRepository } from "@/lib/repositories/user.repository";
import { requirePermission } from "@/lib/core/session";
import { ROLES, type Role } from "@/lib/constants/roles";
import type { UserStatus } from "@/lib/constants/user-status";
import { toPlainObject } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { UserFilters } from "@/components/users/user-filters";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { UserList } from "@/components/users/user-list";

export const metadata: Metadata = { title: "Usuarios" };

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    page?: string;
    filas?: string;
    all?: string;
  }>;
}

export default async function UsersPage({ searchParams }: PageProps) {
  // La barrera real: sin `user:manage` no entra nadie, aunque teclee la URL.
  const admin = await requirePermission("user:manage");

  const params = await searchParams;
  const repository = new UserRepository();
  const pageSize = parsePositive(params.filas) ?? PAGE_SIZE;

  const [result, counts] = await Promise.all([
    repository.search({
      search: params.q,
      role: parseRole(params.role),
      status: parseStatus(params.status),
      page: parsePositive(params.page) ?? 1,
      pageSize,
      // "Cargar más" del celular: trae desde la primera fila hasta ésta.
      accumulate: params.all === "1",
    }),
    repository.countByStatus(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Usuarios"
        description="Quién entra al sistema, con qué rol y desde cuándo"
        action={
          <UserFormDialog
            trigger={
              <Button className="touch-target">
                <Plus className="size-4" aria-hidden />
                Nuevo
              </Button>
            }
          />
        }
      />

      <UserFilters counts={counts} />

      <UserList
        users={toPlainObject(result.items)}
        currentUserId={admin.id}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        pageSize={result.pageSize}
        isFiltered={Boolean(params.q || params.role || params.status)}
      />
    </div>
  );
}

/** Cualquier basura en la URL se ignora en vez de reventar la pantalla. */
function parseRole(value: string | undefined): Role | undefined {
  return ROLES.includes(value as Role) ? (value as Role) : undefined;
}

const STATUSES: UserStatus[] = ["ACTIVE", "SUSPENDED", "DELETED"];

function parseStatus(value: string | undefined): UserStatus | undefined {
  return STATUSES.includes(value as UserStatus)
    ? (value as UserStatus)
    : undefined;
}

function parsePositive(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
