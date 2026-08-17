"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";
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
