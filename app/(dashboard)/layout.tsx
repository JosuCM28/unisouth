import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DesktopBar } from "@/components/layout/desktop-bar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { OfflineIndicator } from "@/components/layout/offline-indicator";
import { SidebarProvider } from "@/components/layout/sidebar-state";
import { isSidebarOpen, SIDEBAR_COOKIE } from "@/lib/constants/sidebar";
import { getCurrentUser } from "@/lib/core/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);

  // El proxy ya redirige de forma optimista, pero ésta es la comprobación
  // que de verdad cuenta: valida la sesión contra la base en cada carga.
  if (!user) redirect("/login");

  return (
    /* El estado plegado se resuelve en el SERVIDOR, leyendo la cookie: así la
       barra se pinta ya en su sitio y no aparece desplegada un instante antes
       de cerrarse sola en cada carga. */
    <SidebarProvider
      defaultOpen={isSidebarOpen(cookieStore.get(SIDEBAR_COOKIE)?.value)}
    >
      {/* Alto exacto de la ventana en escritorio: cada columna scrollea por
          dentro y la barra lateral queda fija. `dvh` y no `vh` porque en
          celular la barra del navegador se esconde al scrollear y `vh` deja
          un salto. */}
      <div className="flex min-h-dvh flex-1 md:h-dvh md:min-h-0 md:overflow-hidden">
        <AppSidebar user={user} />

        <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
          <MobileHeader user={user} />

          {/* Sólo cuando la barra está oculta: es lo que la devuelve. */}
          <DesktopBar />

          {/* `keyboard-safe` reserva abajo la barra inferior MÁS la altura
              del teclado cuando está abierto: sin ese aire el scroll se
              detiene antes y el último botón —el de guardar— queda tapado.

              El padding se declara por lados y NO con `p-4`: la forma corta
              escribe también `padding-bottom` y, al vivir en la misma capa,
              puede pisar el respiro según el orden en que Tailwind emita las
              utilidades. Separados no hay pleito posible. */}
          <main className="keyboard-safe flex-1 px-4 pt-4 md:min-h-0 md:overflow-y-auto md:px-6 md:py-6">
            {children}
          </main>
        </div>

        <MobileNav role={user.role} />

        {/* Sólo aparece si hay capturas sin enviar o se cayó la red. */}
        <OfflineIndicator />
      </div>
    </SidebarProvider>
  );
}
