import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Config de Prisma. Sustituye al bloque `prisma` de package.json, que queda
// deprecado y deja de leerse en Prisma 7.
//
// OJO: en cuanto existe este archivo, Prisma DEJA de cargar .env por su cuenta.
// De ahí el `import "dotenv/config"` de arriba: sin él, DATABASE_URL llega
// vacía y todo comando (db push, migrate, studio) falla al conectar.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),

  migrations: {
    // Antes vivía en package.json#prisma.seed.
    seed: "tsx prisma/seed.ts",
  },
});
