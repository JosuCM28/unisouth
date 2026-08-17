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
    <div className="flex min-h-screen flex-1">
      <AppSidebar user={user} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader user={user} />

        {/* pb-24 en celular: sin ese respiro la barra inferior tapa la última
            fila de la lista y el auxiliar no alcanza el botón de corte. */}
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
