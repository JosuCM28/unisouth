# Cómo arrancar

## 1. Copia los archivos

```
D:\proyects\unisouth\
├── CLAUDE.md              ← Claude Code lo lee solo en cada sesión
├── PROMPTS.md             ← tu guion, un prompt a la vez
└── prisma\
    └── schema.prisma      ← ya listo, no hay que reescribirlo
```

## 2. Rota la contraseña de Neon

La que compartiste ya no es secreta. Ve a Neon → Roles → Reset password del
rol `neondb_owner`. Después arma tu `.env`:

```bash
DATABASE_URL="postgresql://neondb_owner:NUEVO_PASSWORD@ep-rapid-field-ay1xfgrx-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://neondb_owner:NUEVO_PASSWORD@ep-rapid-field-ay1xfgrx.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"
BETTER_AUTH_SECRET="genera_con_openssl_rand_base64_32"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

`DIRECT_URL` es la misma cadena **sin** `-pooler`. Prisma la necesita para
migraciones; el pooler de Neon no las soporta.

## 3. Arranca Claude Code

```bash
cd D:\proyects\unisouth
claude
```

Pega la FASE 0 de `PROMPTS.md`. Nada más. Espera a que termine.

## 4. Ritmo de trabajo

Después de cada fase:

```bash
npx tsc --noEmit
git add -A && git commit -m "fase N: ..."
```

Si el contexto se llena, `/compact`. `CLAUDE.md` se relee solo, así que no
pierdes las reglas.

## Reglas de convivencia con Claude Code

- **Un prompt por vez.** Pegar dos fases juntas es la forma más rápida de que
  te entregue código a medias en las dos.
- **Revisa antes de commitear.** Sobre todo la fase 6 (InventoryService): ahí
  se juega la integridad de todo el inventario.
- **Si empieza a improvisar features**, párale y dile: "Termina sólo lo que
  te pedí en esta fase."
- **Si el código se desvía del diseño flat**, usa el prompt suelto del final
  de PROMPTS.md.

## Orden de fases

| Fase | Qué entrega | Depende de |
|---|---|---|
| 0 | Andamiaje + tema flat | — |
| 1 | Prisma + Neon + seed | 0 |
| 2 | Núcleo (errores, repo base, auditoría) | 1 |
| 3 | Roles, labels, BetterAuth, login | 2 |
| 4 | Layout, sidebar, barra móvil, tablero | 3 |
| 5 | Repositorios + esquemas Zod | 2 |
| 6 | **InventoryService** (crítica) | 5 |
| 7 | Servicios de dominio + actions | 6 |
| 8 | CRUD Ubicaciones (plantilla) | 7 |
| 9 | CRUD Materiales, Clientes, Producciones | 8 |
| 10 | **Inventario móvil** (pantalla principal) | 9 |
| 11 | Fichas técnicas + motor de cálculo | 10 |
| 12 | Documentos, requisiciones, auditoría | 11 |
| 13 | Cierre y verificación | 12 |

Con las fases 0 a 10 ya tienes algo mejor que tu libreta y usable en el piso.
Las 11 a 13 son lo que impresiona a los patrones.
