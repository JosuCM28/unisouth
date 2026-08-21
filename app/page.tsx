import { redirect } from "next/navigation";
import { landingRoute } from "@/lib/constants/navigation";
import { roleHasPermission } from "@/lib/constants/roles";
import { getCurrentUser } from "@/lib/core/session";

/**
 * La raíz no tiene contenido propio: es un desvío.
 *
 * Con sesión manda al primer destino de su rol; sin ella, al login. Sin esto,
 * quien entra a `/` —o quien inicia sesión con `?redirect=/`— aterriza en una
 * página en blanco en vez de en la app.
 *
 * El destino NO es `/dashboard` fijo: Dirección no puede verlo y caería en un
 * error de permiso recién iniciada la sesión.
 */
export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  redirect(landingRoute(user.role, roleHasPermission));
}
