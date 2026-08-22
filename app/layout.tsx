import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { KeyboardInsets } from "@/components/layout/keyboard-insets";
import { ServiceWorkerRegistrar } from "@/components/layout/service-worker";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Unisouth",
    template: "%s · Unisouth",
  },
  description: "Control de inventario textil rollo por rollo",
  // Permite instalarla en el celular y, con el service worker, abrirla sin red.
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Unisouth", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // La app se usa con una mano en el piso de bodega: el zoom accidental
  // al tocar un input estorba más de lo que ayuda.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Pinta la barra del navegador del mismo slate del sistema.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1e293b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-MX"
      className={`${inter.variable} h-full antialiased`}
    >
      {/* En escritorio el documento NO scrollea: mide exactamente la ventana y
          el desbordamiento lo resuelve cada columna por dentro. Con `min-h-full`
          el body crecía con la lista y se llevaba la barra lateral hacia arriba,
          que es justo lo que se quiere evitar.

          En celular sí scrollea el documento (`min-h-dvh` y sin overflow): ahí
          no hay barra lateral que perder y el scroll natural es el correcto,
          además de que oculta la barra de direcciones del navegador. */}
      <body className="flex min-h-dvh flex-col font-sans md:h-dvh md:min-h-0 md:overflow-hidden">
        {children}

        {/* No pinta nada: mide el teclado del celular y sube el campo enfocado
            por encima de él. Va en el layout raíz para que valga en TODA la
            app, login incluido. */}
        <KeyboardInsets />

        {/* Tampoco pinta nada: registra el service worker para que la app
            abra en los puntos muertos del almacén. */}
        <ServiceWorkerRegistrar />

        {/* Arriba y al centro: abajo lo taparía la barra de navegación móvil. */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
