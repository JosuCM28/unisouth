"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";
import { isOfflineDbAvailable } from "@/lib/offline/db";
import { clearSnapshot } from "@/lib/offline/sync-engine";
import { Button } from "@/components/ui/button";

/** Cierra sesión. Cliente porque necesita el router y el estado de carga. */
export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);

    const { error } = await signOut();

    if (error) {
      toast.error("No se pudo cerrar la sesión. Intenta de nuevo.");
      setIsPending(false);
      return;
    }

    await forgetLocalCopy();

    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleSignOut}
      disabled={isPending}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      className="touch-target shrink-0"
    >
      <LogOut className="size-4" aria-hidden />
    </Button>
  );
}

/**
 * Al salir se borra la copia sin conexión de este equipo.
 *
 * La copia trae rollos, órdenes y clientes de quien manda a maquilar. Si se
 * quedara, el siguiente que use el celular —con otro rol, o sin cuenta— la
 * tendría en el navegador sin haber pasado por los permisos.
 *
 * La cola de capturas pendientes NO se toca: son capturas que todavía no
 * llegan al servidor, y borrarlas las perdería para siempre.
 *
 * Si falla el borrado no se detiene la salida: la sesión ya se cerró y
 * dejar al usuario atorado aquí sería peor.
 */
async function forgetLocalCopy(): Promise<void> {
  if (!isOfflineDbAvailable()) return;

  try {
    await clearSnapshot();
  } catch (error) {
    console.error("[offline] No se pudo borrar la copia al salir:", error);
  }
}
