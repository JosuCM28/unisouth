import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    // `keyboard-safe-only`: al abrir el teclado el documento necesita margen
    // abajo para poder scrollear, o el campo enfocado se queda tapado aunque
    // el navegador quiera subirlo. Sin ese aire no hay a dónde ir.
    <main className="keyboard-safe-only safe-top safe-bottom flex flex-1 items-center justify-center px-4 pt-4">
      <div className="flat-surface w-full max-w-sm p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">UNISOUTH</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Control de almacén textil
          </p>
        </div>

        {/* useSearchParams obliga a un límite de Suspense para prerenderizar. */}
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
