import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Redirección OPTIMISTA, no autorización.
 *
 * Aquí sólo se mira si EXISTE la cookie de sesión; no se valida la firma, ni
 * que la sesión siga viva, ni qué rol tiene el usuario. El proxy corre antes
 * de cada petición y consultar la base en cada navegación sería carísimo.
 *
 * La autorización REAL siempre ocurre en el servidor: `requirePermission()`
 * dentro de `executeAction`, y `requireUser()` en las páginas. Alguien con
 * una cookie inventada llega a la pantalla, pero no logra ejecutar nada.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));
  const isLoginRoute = pathname.startsWith("/login");

  if (!hasSession && !isLoginRoute) {
    const loginUrl = new URL("/login", request.url);
    // Se conserva a dónde iba para devolverlo ahí después de entrar.
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isLoginRoute) {
    /* A la raíz y no a `/dashboard`: aquí sólo se ve la cookie, no el rol, y
       el tablero está cerrado para Dirección. `/` sí lee la sesión y manda a
       cada quien al primer destino que su rol puede ver. */
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /**
     * Todo menos:
     *  · api/auth  → el propio BetterAuth; protegerlo impediría iniciar sesión
     *  · _next     → bundles y optimización de imágenes
     *  · archivos estáticos y de PWA
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
