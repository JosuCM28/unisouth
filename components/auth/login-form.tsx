"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loginAction } from "@/app/actions/auth.actions";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { runAction } from "@/lib/offline/run-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Sólo se acepta una ruta interna.
 *
 * Sin esta guarda, `?redirect=https://sitio-malicioso.com` mandaría al
 * usuario fuera JUSTO después de teclear su contraseña, que es cuando más
 * confía en lo que ve.
 *
 * El destino por defecto es `/` y no `/dashboard`: aquí no se conoce el rol, y
 * el tablero está cerrado para Dirección. `/` es un desvío que sí lee la
 * sesión y manda a cada quien a donde su rol puede entrar.
 */
function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith("/")) return "/";

  // `//evil.com` y `/\evil.com` son rutas relativas al protocolo: el
  // navegador las trata como absolutas.
  if (target.startsWith("//") || target.startsWith("/\\")) return "/";

  return target;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setIsSubmitting(true);

    // Pasa por una Server Action, no por el cliente de BetterAuth: así el
    // límite de intentos se aplica en el servidor, donde no se puede saltar.
    const result = await runAction(() => loginAction(values));

    if (!result.success) {
      setError("password", { message: result.error });
      toast.error(result.error);
      setIsSubmitting(false);
      return;
    }

    // Vuelve a donde iba antes de que el proxy lo mandara al login.
    const redirectTo = safeRedirect(searchParams.get("redirect"));
    toast.success("Bienvenido");
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="tu@empresa.com"
          className="touch-target"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="touch-target"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="touch-target mt-2 w-full"
      >
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
