import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // No hay verificación por correo: al auxiliar lo da de alta el
    // administrador en persona, y muchos no tienen correo de la empresa.
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "READ_ONLY",
        // input:false → el rol JAMÁS se acepta desde el cliente. Si no,
        // cualquiera podría registrarse mandando role: "ADMIN" en el body.
        input: false,
      },
      phone: {
        type: "string",
        required: false,
      },
      active: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
      pinHash: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },

  session: {
    // 30 días: el celular de bodega no se cierra sesión todos los días y
    // volver a teclear la contraseña con guantes es un suplicio.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      // Evita ir a la base en cada navegación. 5 minutos es el techo de lo
      // que puede tardar en surtir efecto una baja de usuario.
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  advanced: {
    /**
     * En producción la cookie viaja sólo por HTTPS y con SameSite=Lax, que
     * es lo que impide que un sitio ajeno la mande en una petición CSRF.
     * En desarrollo se relaja porque localhost no tiene TLS.
     */
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
    },
  },

  /** Orígenes autorizados a mandar peticiones con credenciales. */
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ],

  plugins: [
    admin({
      defaultRole: "READ_ONLY",
      adminRoles: ["ADMIN"],
    }),
    // nextCookies SIEMPRE al final: es quien escribe las cookies en la
    // respuesta y debe correr después de todos los demás plugins.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
