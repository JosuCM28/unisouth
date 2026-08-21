import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getCurrentUser } from "@/lib/core/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  // El proxy ya redirige de forma optimista, pero ésta es la comprobación
  // que de verdad cuenta: valida la sesión contra la base en cada carga.
  if (!user) redirect("/login");

  return (
    /* Alto exacto de la ventana en escritorio: cada columna scrollea por
       dentro y la barra lateral queda fija. `dvh` y no `vh` porque en celular
       la barra del navegador se esconde al scrollear y `vh` deja un salto. */
    <div className="flex min-h-dvh flex-1 md:h-dvh md:min-h-0 md:overflow-hidden">
      <AppSidebar user={user} />

      <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
        <MobileHeader user={user} />

        {/* `keyboard-safe` = pb-24 en celular (la barra inferior tapa la última
            fila y el auxiliar no alcanza el botón de corte) MÁS la altura del
            teclado cuando está abierto: sin ese extra el scroll se detiene
            justo donde empieza el teclado y el último campo nunca sube. */}
        <main className="keyboard-safe flex-1 p-4 md:min-h-0 md:overflow-y-auto md:p-6 md:pb-6">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
