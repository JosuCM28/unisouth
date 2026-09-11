"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  LogOut,
  MoreVertical,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import type { UserRow } from "@/lib/repositories/user.repository";
import { userStatus } from "@/lib/constants/user-status";
import { closeUserSessionsAction } from "@/app/actions/user.actions";
import { runAction } from "@/lib/offline/run-action";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserFormDialog } from "./user-form-dialog";
import { UserPasswordDialog } from "./user-password-dialog";
import { UserRoleDialog } from "./user-role-dialog";
import { UserStatusDialog, type StatusOperation } from "./user-status-dialog";

interface Props {
  user: UserRow;
  currentUserId: string;
}

/**
 * Menú de fila de un usuario.
 *
 * No usa `RowActions` compartido a propósito: ahí "dar de baja" es la única
 * acción destructiva y aquí hay cuatro que se parecen —rol, contraseña,
 * suspensión y baja— y cada una abre su propio diálogo con su propio motivo.
 *
 * Qué se ofrece depende del estado y de si es uno mismo. Ocultar lo que no
 * procede evita que el administrador se entere de la regla sólo cuando el
 * servidor le dice que no: sobre su propia cuenta puede corregir sus datos y
 * su contraseña, pero no quitarse el acceso.
 */
export function UserActions({ user, currentUserId }: Props) {
  const router = useRouter();
  const [operation, setOperation] = useState<StatusOperation | null>(null);
  const [dialog, setDialog] = useState<"role" | "password" | null>(null);
  const [closing, setClosing] = useState(false);

  const isSelf = user.id === currentUserId;
  const status = userStatus(user);
  const isDeleted = status === "DELETED";

  async function closeSessions() {
    setClosing(true);
    const result = await runAction(() => closeUserSessionsAction({ id: user.id }));
    setClosing(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`Se cerraron las sesiones de ${user.name}`);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="touch-target"
            aria-label={`Acciones de ${user.name}`}
          >
            <MoreVertical className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {/* A un dado de baja sólo se le puede reactivar: editarle el correo
              o la contraseña a alguien que ya no entra no sirve de nada. */}
          {isDeleted ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setOperation("RESTORE");
              }}
            >
              <RotateCcw className="size-4" aria-hidden />
              Reactivar
            </DropdownMenuItem>
          ) : (
            <>
              <UserFormDialog
                user={user}
                trigger={
                  <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                    <Pencil className="size-4" aria-hidden />
                    Editar datos
                  </DropdownMenuItem>
                }
              />

              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setDialog("password");
                }}
              >
                <KeyRound className="size-4" aria-hidden />
                Cambiar contraseña
              </DropdownMenuItem>

              {!isSelf && (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    setDialog("role");
                  }}
                >
                  <ShieldCheck className="size-4" aria-hidden />
                  Cambiar rol
                </DropdownMenuItem>
              )}

              {/* Sobre uno mismo no se ofrece: para salir de este equipo está
                  el botón de cerrar sesión, que además limpia la cookie. */}
              {!isSelf && user.sessionCount > 0 && (
                <DropdownMenuItem
                  disabled={closing}
                  onSelect={(event) => {
                    event.preventDefault();
                    void closeSessions();
                  }}
                >
                  <LogOut className="size-4" aria-hidden />
                  Cerrar sesiones ({user.sessionCount})
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {status === "SUSPENDED" ? (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    setOperation("REACTIVATE");
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Quitar suspensión
                </DropdownMenuItem>
              ) : (
                !isSelf && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setOperation("SUSPEND");
                    }}
                  >
                    <UserMinus className="size-4" aria-hidden />
                    Suspender
                  </DropdownMenuItem>
                )
              )}

              {!isSelf && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(event) => {
                    event.preventDefault();
                    setOperation("REMOVE");
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Dar de baja
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <UserRoleDialog
        user={user}
        open={dialog === "role"}
        onOpenChange={(open) => setDialog(open ? "role" : null)}
      />

      <UserPasswordDialog
        user={user}
        isSelf={isSelf}
        open={dialog === "password"}
        onOpenChange={(open) => setDialog(open ? "password" : null)}
      />

      <UserStatusDialog
        user={user}
        operation={operation}
        onClose={() => setOperation(null)}
      />
    </>
  );
}
