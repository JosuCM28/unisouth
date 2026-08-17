import { z } from "zod";

/**
 * Mismo esquema en el formulario (RHF) y en el servidor.
 * Importarlo en los dos lados es lo que evita que se desincronicen.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Escribe tu correo")
    .email("El correo no tiene un formato válido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export type LoginInput = z.infer<typeof loginSchema>;
