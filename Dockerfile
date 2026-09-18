# ═══════════════════════════════════════════════════════════════════════════
#  UNISOUTH — imagen de producción
#
#  Tres etapas para que la imagen final no cargue con el compilador ni con
#  las dependencias de desarrollo. Resultado: ~300 MB en vez de ~1.2 GB.
#
#  De esos ~300, algo más de 100 son el CLI de Prisma: viaja a la imagen para
#  aplicar las migraciones pendientes al arrancar. El porqué está abajo, junto
#  al COPY que lo trae.
# ═══════════════════════════════════════════════════════════════════════════

# Se fija la versión menor, no `22-alpine` a secas: un cambio silencioso de
# Node entre dos deploys es de los fallos más difíciles de rastrear.
FROM node:22.17-alpine AS base

# Prisma necesita OpenSSL para su motor de consultas; Alpine no lo trae.
RUN apk add --no-cache openssl libc6-compat


# ── 1. Dependencias ────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Sólo los manifiestos: así esta capa se reutiliza mientras no cambien las
# dependencias, aunque se toque el código.
COPY package.json package-lock.json ./

# `npm ci` respeta el lockfile al pie de la letra. `npm install` podría
# resolver versiones distintas a las probadas.
RUN npm ci


# ── 2. Compilación ─────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# El cliente de Prisma se genera DENTRO del contenedor para que el motor sea
# el de musl (Alpine), no el de la máquina donde se escribió el código.
RUN npx prisma generate

# Next valida las variables públicas al compilar. Ésta se hornea en el
# bundle del cliente —es la base del QR de cada rollo—, así que Dokploy debe
# pasarla como build arg además de como variable de entorno.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# Marcador para que ninguna página intente conectarse a la base durante el
# build. Las páginas son dinámicas (leen cookies), así que no se
# prerenderizan, pero un import descuidado podría intentar abrir conexión.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DIRECT_URL="postgresql://build:build@localhost:5432/build"

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build


# ── 3. Ejecución ───────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario sin privilegios: si alguien logra ejecutar código en el
# contenedor, no lo hace como root.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# El build `standalone` deja un servidor con SÓLO las dependencias que usa.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# El schema y el motor de Prisma: `standalone` no los arrastra solo.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# ── El CLI de Prisma, para migrar al arrancar ──────────────────────────────
# Sí, pesa: el CLI y su schema-engine suman más de 100 MB a una imagen que
# presume de ser chica. Se paga a propósito.
#
# La alternativa era seguir aplicando los cambios de esquema a mano, y eso ya
# se probó: la historia de migraciones se separó del esquema real y recuperarla
# costó una base sombra y un migration de alcance. Cien megas en el disco del
# VPS valen menos que volver a eso.
#
# @prisma/engines va aparte porque el CLI no lo empaqueta: ahí vive el
# schema-engine, que es el binario que aplica los .sql.
#
# NO se copia prisma.config.ts a propósito. Ese archivo hace
# `import "dotenv/config"` para leer el .env en desarrollo, y aquí no hay .env
# ni dotenv: las variables las inyecta Dokploy. Sin él, el CLI usa su ruta por
# omisión —prisma/schema.prisma, que es justo donde está— y lee el entorno.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/engines ./node_modules/@prisma/engines

# ── Fotos de las órdenes ───────────────────────────────────────────────────
# La carpeta se crea AQUÍ, en la imagen, y no en el servidor a mano.
#
# No es un detalle de comodidad: cuando Docker monta un volumen con nombre
# sobre una ruta que YA EXISTE en la imagen, le copia el contenido y —lo que
# importa— el DUEÑO de esa ruta. Con la carpeta creada de antemano a nombre de
# `nextjs`, el volumen nace escribible y no hace falta entrar por SSH a
# corregir permisos.
#
# Si la ruta no existiera en la imagen, el volumen se crearía a nombre de root
# y la app —que corre sin privilegios— no podría escribir una sola foto.
#
# OJO: esto vale para un volumen CON NOMBRE. Un bind mount de una carpeta del
# servidor NO hereda nada: ahí manda el dueño de la carpeta del host.
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

# Por omisión, para que la app no dependa de que alguien recuerde ponerla.
# Montar el volumen encima no la cambia: la ruta es la misma.
ENV UPLOADS_DIR=/app/uploads

# A propósito SIN `VOLUME`: esa instrucción haría que cada despliegue creara
# un volumen anónimo distinto —las fotos se perderían igual— y además iría
# dejando volúmenes huérfanos comiéndose el disco del VPS. El montaje se
# declara en Dokploy, que es donde se puede apuntar siempre al mismo.

# El arranque: migrar y luego servir. Va antes del `USER` para que el chown y
# el chmod corran como root.
#
# El permiso se da con RUN y no con `COPY --chmod`: esa bandera sólo existe
# con BuildKit, y si el builder de turno es el clásico la construcción falla
# con un error de sintaxis que no explica por qué.
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

# Dokploy lo usa para saber si el contenedor está sano antes de mandarle
# tráfico. `/login` es público: no necesita sesión ni toca la base.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/login || exit 1

# Ya no arranca el servidor directo: antes pasa por las migraciones
# pendientes. El entrypoint termina con `exec node server.js`, así que el
# proceso final es el mismo de siempre.
CMD ["./docker-entrypoint.sh"]
