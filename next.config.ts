import type { NextConfig } from "next";

/**
 * Content-Security-Policy.
 *
 * Es la defensa de fondo contra XSS: aunque alguien lograra inyectar un
 * `<script>`, el navegador se negaría a ejecutarlo por no estar permitido.
 *
 * `unsafe-inline` y `unsafe-eval` en `script-src` son inevitables hoy: Next
 * inyecta scripts en línea para hidratar y para el streaming de Suspense.
 * Quitarlos requiere nonces por petición, que obliga a hacer dinámica cada
 * página. Se documenta como deuda consciente, no como descuido.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // La app sólo habla con su propio servidor y con la base.
  "connect-src 'self'",
  // El escáner de QR usa la cámara vía getUserMedia, no media externo.
  "media-src 'self' blob:",
  // Nada de esta app debe cargarse dentro de un iframe ajeno: es la
  // protección contra clickjacking.
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // Los formularios sólo se envían a este mismo origen.
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // Refuerza frame-ancestors para navegadores viejos.
  { key: "X-Frame-Options", value: "DENY" },
  // Impide que el navegador "adivine" el tipo de un archivo servido.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No filtrar la URL interna (que lleva folios) a sitios externos.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Sólo se pide la cámara, y sólo desde el propio origen.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  /**
   * Empaqueta el servidor con sólo las dependencias que de verdad usa.
   *
   * Sin esto habría que copiar `node_modules` entero al contenedor: ~600 MB
   * contra ~150 MB. En un VPS de Hostinger eso es la diferencia entre un
   * deploy de minutos y uno que se queda sin disco.
   */
  output: "standalone",

  experimental: {
    serverActions: {
      // Las fotos de rollo y los PDF de remisión se suben desde el celular.
      bodySizeLimit: "4mb",
    },
  },

  // Prisma usa binarios nativos: no debe pasar por el bundler del servidor.
  serverExternalPackages: ["@prisma/client"],

  // No anunciar la versión del framework: es información gratis para quien
  // busca vulnerabilidades conocidas.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        // Las descargas nunca se cachean: llevan datos del inventario.
        source: "/api/export/:path*",
        headers: [
          ...SECURITY_HEADERS,
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
