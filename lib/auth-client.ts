"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

/**
 * Sin `baseURL`: la API de auth vive en esta misma app, así que las
 * peticiones deben ir al mismo origen desde el que se sirvió la página.
 *
 * Fijar aquí NEXT_PUBLIC_APP_URL rompía el cierre de sesión en producción.
 * Esa variable se hornea en el bundle del cliente AL COMPILAR; si no llega
 * como build arg, el navegador queda apuntando a localhost y la CSP
 * (`connect-src 'self'`) bloquea la petición. El login no se veía afectado
 * porque va por Server Action; el logout es el único que sale por fetch.
 */
export const authClient = createAuthClient({
  plugins: [adminClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
