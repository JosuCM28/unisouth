import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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
      <body className="flex min-h-full flex-col font-sans">
        {children}
        {/* Arriba y al centro: abajo lo taparía la barra de navegación móvil. */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
