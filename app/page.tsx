import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/core/session";

/**
 * La raíz no tiene contenido propio: es un desvío.
 *
 * Con sesión manda al tablero; sin ella, al login. Sin esto, quien entra a
 * `/` —o quien inicia sesión con `?redirect=/`— aterriza en una página en
 * blanco en vez de en la app.
 */
export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  redirect("/dashboard");
}
